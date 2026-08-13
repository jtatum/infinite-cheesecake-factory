export const runtime = "edge";

import { getAuthenticatedUser, noStoreHeaders } from "../../../lib/auth";
import { verifyDishToken } from "../../../lib/dish-token";
import { reserveQuota } from "../../../lib/quota";
import { recordGeneration } from "../../../lib/analytics";

const RUNWARE_MODEL = "runware:twinflow-z-image-turbo@0";

type RunwareResult = {
  taskType?: string;
  taskUUID?: string;
  imageURL?: string;
  imageDataURI?: string;
  NSFWContent?: boolean;
  cost?: number;
};

export async function POST(request: Request) {
  const apiKey = process.env.RUNWARE_API_KEY;
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Sign in to use the image kitchen." }, { status: 401, headers: noStoreHeaders() });
  }
  if (!apiKey || !process.env.DISH_TOKEN_SECRET) {
    return Response.json({ error: "The image kitchen is not fully configured." }, { status: 503, headers: noStoreHeaders() });
  }

  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const authorizedDish = await verifyDishToken(String(body.token || ""), user.id).catch(() => null);
  if (!authorizedDish) {
    return Response.json({ error: "This dish ticket is invalid or expired. Load a fresh menu and try again." }, { status: 403, headers: noStoreHeaders() });
  }

  try {
    const quota = await reserveQuota(user, "image");
    if (!quota.ok) {
      const message = quota.reason === "global"
        ? "The image kitchen has reached its safety limit for today. Please return tomorrow."
        : "You have reached today’s image quota. It resets at midnight UTC.";
      return Response.json({ error: message }, { status: 429, headers: noStoreHeaders({ "Retry-After": "3600" }) });
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Quota service is unavailable." },
      { status: 503, headers: noStoreHeaders() },
    );
  }

  const name = String(authorizedDish.name).slice(0, 160);
  const description = String(authorizedDish.description).slice(0, 600);
  const category = String(authorizedDish.category).slice(0, 100);
  const ingredients = authorizedDish.ingredients.slice(0, 6).map(String).join(", ").slice(0, 500);
  const artDirection = String(authorizedDish.imagePrompt).slice(0, 1600);
  const isDessert = /dessert|cheesecake|cake|pie|sweet|pastry|sundae|gelato|ice cream/i.test(`${category} ${name}`);
  const prompt = `A photoreal editorial restaurant photograph of the fictional ${category.toLowerCase()} called ${name}. ${description} It visibly contains ${ingredients}. ${artDirection} Make every conceptual word in the dish name and description physically visible through at least two impossible edible sculptures, garnish shapes, sauce patterns, or food architecture. Every apparent object must be visibly fabricated from recognizable food textures; never use a literal non-food prop. The result must look specifically unlike an ordinary generic ${category.toLowerCase()}. Show only the plated food and a tasteful table surface, with absolutely no writing or display elements anywhere.`;

  try {
    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify([
        {
          taskType: "imageInference",
          taskUUID: crypto.randomUUID(),
          model: RUNWARE_MODEL,
          positivePrompt: `${prompt}\nSquare editorial restaurant food photograph, dramatic direct flash, appetizing, intricate physical textures, sophisticated surreal plating, centered composition, no text in the image.`,
          negativePrompt: `text, typography, writing, letters, numbers, words, labels, captions, title card, menu, menu board, signage, logo, watermark, signature, packaging, screens, people, hands, plastic, electronics, real telephone, real cable, tools, non-food props, gross food, spoiled food, low resolution, blurry, ordinary generic food${isDessert ? "" : ", cheesecake, cake slice, pie slice, frosting, dessert"}`,
          width: 1024,
          height: 1024,
          steps: 4,
          CFGScale: 3.5,
          numberResults: 1,
          outputType: "URL",
          outputFormat: "WEBP",
          outputQuality: 92,
          deliveryMethod: "sync",
          includeCost: true,
          checkContent: true,
        },
      ]),
    });

    const payload = (await response.json()) as { data?: RunwareResult[]; errors?: Array<{ message?: string }> };
    if (!response.ok || payload.errors?.length) {
      throw new Error(payload.errors?.[0]?.message || "Runware image generation failed");
    }

    const result = payload.data?.find((item) => item.taskType === "imageInference");
    const image = result?.imageURL || result?.imageDataURI;
    if (!image || result?.NSFWContent) throw new Error("No usable image returned");

    await recordGeneration(user, "image").catch((error) => {
      console.error("[analytics] unable to record image generation", error);
    });

    return Response.json({
      image,
      demo: false,
      provider: "runware",
      model: RUNWARE_MODEL,
      cost: result.cost,
    }, { headers: noStoreHeaders() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Runware image generation failed." },
      { status: 502, headers: noStoreHeaders() },
    );
  }
}
