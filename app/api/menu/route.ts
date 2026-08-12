import { makeFallbackMenu, type Dish, type Topic } from "../../../lib/menu";

export const runtime = "edge";

async function getWikipediaTopic(): Promise<Topic | null> {
  try {
    const response = await fetch("https://en.wikipedia.org/api/rest_v1/page/random/summary", {
      headers: { "User-Agent": "InfiniteCheesecake/1.0 (surreal menu game)" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    if (!data.title) return null;
    return {
      title: data.title,
      extract: data.extract?.slice(0, 700),
      url: data.content_urls?.desktop?.page,
    };
  } catch {
    return null;
  }
}

type ChefDish = Omit<Dish, "id" | "source">;

const chefInstructions = "You are the deadpan executive chef of an impossible infinite cheesecake restaurant. Create funny, surreal menu items that feel conceptually tied to each supplied encyclopedia topic. Avoid random-word soup, gross-out humor, copyrighted characters, and explanations of the joke. Every item must be a kind of cheesecake. Descriptions should be 25–45 words and read like confident fine-dining menu copy. Prices use strange currencies or social costs. imagePrompt must describe an appetizing but impossible editorial food photograph with no text. Return ONLY valid JSON shaped exactly like {\"dishes\":[{\"name\":string,\"description\":string,\"price\":string,\"category\":string,\"warning\":string,\"emoji\":string,\"ingredients\":string[3-5],\"imagePrompt\":string}]}.";

function finishDishes(dishes: ChefDish[], topics: Topic[], offset: number) {
  if (!Array.isArray(dishes) || dishes.length !== topics.length) return null;
  return dishes.map((dish, index) => ({
    ...dish,
    id: `ai-${offset + index}-${Math.random().toString(36).slice(2, 8)}`,
    source: {
      title: topics[index].title,
      url: topics[index].url || `https://en.wikipedia.org/wiki/${encodeURIComponent(topics[index].title.replace(/ /g, "_"))}`,
    },
  }));
}

function parseChefJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as { dishes: ChefDish[] };
}

async function askLocalChef(topics: Topic[], seed: string, offset: number): Promise<Dish[] | null> {
  const baseUrl = (process.env.LOCAL_LLM_BASE_URL || "http://ultrahorse:3000/v1").replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.LOCAL_LLM_API_KEY) headers.Authorization = `Bearer ${process.env.LOCAL_LLM_API_KEY}`;

  try {
    let model = process.env.LOCAL_LLM_MODEL;
    if (!model) {
      const modelsResponse = await fetch(`${baseUrl}/models`, { headers, signal: AbortSignal.timeout(4000) });
      if (modelsResponse.ok) {
        const models = (await modelsResponse.json()) as { data?: Array<{ id?: string }> };
        model = models.data?.[0]?.id;
      }
    }
    if (!model) model = "local-model";

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model,
        temperature: 1.05,
        messages: [
          { role: "system", content: chefInstructions },
          { role: "user", content: `Factory seed: ${seed}. Make exactly ${topics.length} dishes, in the same order as these topics: ${JSON.stringify(topics)}` },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const outputText = data.choices?.[0]?.message?.content;
    if (!outputText) return null;
    return finishDishes(parseChefJson(outputText).dishes, topics, offset);
  } catch {
    return null;
  }
}

async function askOpenAIChef(topics: Topic[], seed: string, offset: number): Promise<Dish[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna",
        input: `${chefInstructions}\nFactory seed: ${seed}. Make exactly ${topics.length} dishes from: ${JSON.stringify(topics)}`,
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const outputText = data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
    if (!outputText) return null;
    return finishDishes(parseChefJson(outputText).dishes, topics, offset);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { seed?: string; offset?: number };
  const seed = String(body.seed || "the default timeline").slice(0, 100);
  const offset = Number.isFinite(body.offset) ? Number(body.offset) : 0;
  const fetched = await Promise.all(Array.from({ length: 6 }, () => getWikipediaTopic()));
  const topics = fetched.filter((topic): topic is Topic => Boolean(topic));
  const fallback = makeFallbackMenu(seed, offset, 6, topics.length ? topics : undefined);
  const localDishes = topics.length === 6 ? await askLocalChef(topics, seed, offset) : null;
  const openAIDishes = !localDishes && topics.length === 6 ? await askOpenAIChef(topics, seed, offset) : null;

  return Response.json({
    dishes: localDishes || openAIDishes || fallback,
    chef: localDishes ? "local-llm" : openAIDishes ? "openai" : "house",
    source: topics.length ? "wikipedia" : "archive",
  });
}
