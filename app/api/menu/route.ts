import type { Dish, Topic } from "../../../lib/menu";
import wikipediaSubjects from "../../../data/wikipedia-subjects.json";
import { getAuthenticatedUser, noStoreHeaders } from "../../../lib/auth";
import { signDish } from "../../../lib/dish-token";
import { reserveQuota } from "../../../lib/quota";
import { recordGeneration } from "../../../lib/analytics";

export const runtime = "edge";
const BATCH_SIZE = 5;

const wikipediaConcepts = wikipediaSubjects as Topic[];

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleWikipediaConcepts(count: number, seed: string, offset: number) {
  const random = seededRandom(hashSeed(seed));
  const byFamily = new Map<string, Topic[]>();
  for (const topic of wikipediaConcepts) {
    const family = topic.family || "uncategorized";
    byFamily.set(family, [...(byFamily.get(family) || []), topic]);
  }
  const families = [...byFamily.keys()];
  if (families.length < count) {
    const copy = [...wikipediaConcepts];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    const start = (Math.floor(offset / 10) * count) % copy.length;
    return Array.from({ length: count }, (_, index) => copy[(start + index) % copy.length]);
  }
  for (let index = families.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [families[index], families[target]] = [families[target], families[index]];
  }
  const batch = Math.floor(offset / BATCH_SIZE);
  const familyRound = Math.floor((batch * count) / families.length);
  return Array.from({ length: count }, (_, index) => {
    const family = families[(batch * count + index) % families.length];
    const topics = byFamily.get(family)!;
    const familyOffset = hashSeed(`${seed}:${family}`) % topics.length;
    return topics[(familyRound + familyOffset) % topics.length];
  });
}

function pairWikipediaConcepts(topics: Topic[]) {
  const conceptualFamilies = new Set(["phenomena", "systems", "techniques", "ideas", "culture"]);
  const conceptual = topics.filter((topic) => conceptualFamilies.has(topic.family || ""));
  const physical = topics.filter((topic) => !conceptualFamilies.has(topic.family || ""));
  if (conceptual.length === BATCH_SIZE && physical.length === BATCH_SIZE) {
    return conceptual.map((topic, index) => [topic, physical[index]] as [Topic, Topic]);
  }
  return Array.from({ length: BATCH_SIZE }, (_, index) => [topics[index], topics[index + BATCH_SIZE]] as [Topic, Topic]);
}

type ChefDish = Omit<Dish, "id" | "source">;

const chefInstructions = `You are the deadpan executive chef of an impossible, maximalist faux-upscale casual chain restaurant with a famously enormous menu.

SURREALISM IS THE PRODUCT. A normal restaurant dish with a clever name, a themed sauce, or one novelty garnish is a failed answer. Each item must provoke an immediate "wait, what?" while still sounding confidently orderable. Make coherent visual jokes, not random-word soup, and never explain the joke.

You will receive five explicit PAIRS of unrelated encyclopedia articles. Create exactly one dish from each pair, in order. The dish must be a true collision: pull at least one specific trait, mechanism, shape, behavior, or consequence from EACH article and fuse them into one central culinary idea. Both inspirations must be recognizable in the dish name and description, not merely hidden in imagePrompt. A dish that mostly represents one article while using the other as a garnish, adjective, flavor, or pun is a failed answer.

Escalate the transformations. Across every batch:
- at least 3 dishes must be physically impossible edible constructions, processes, architectures, ecosystems, or behaviors;
- at least 2 must be EXTREMELY strange, with the food doing something an ordinary dish cannot do;
- literalize abstractions as edible geometry, mechanisms, layers, motion, repetition, scale shifts, or impossible plating;
- vary the comedic move: transformation, literalization, category error, impossible scale, bureaucratic food ritual, or culinary physics;
- never solve the concept with printed words, labels, logos, screens, ordinary props, or a single shaped garnish.

Avoid gross-out humor, copyrighted characters, real people, real places, and brand names. This is a full restaurant menu, NOT a cheesecake-only menu: make exactly 4 savory dishes and 1 dessert; use at least 4 distinct recognizable menu sections such as appetizers, soups, salads, pasta, pizza, sandwiches, burgers, seafood, steaks, brunch, sides, cocktails, or desserts; include at most one cheesecake. Make every dish genuinely distinct: do not repeat names, central nouns, ingredients, joke structures, or description templates. Never prefix dish names with numbers.

Descriptions should be 16–28 words of dead-serious glossy menu copy, and must state the impossible physical or behavioral feature. Prices use strange currencies or social costs. Warnings should extend the joke with a new consequence. Use exactly 3 concise ingredients.

imagePrompt is crucial: write one vivid photographic sentence showing this exact dish. Describe its food form, colors, plating, and at least THREE conspicuous impossible details made entirely from edible materials or arrangements. Translate concepts into visible physical forms: a voicemail reduction becomes glossy sauce piped as sound-wave arcs; telecom pasta tangles into edible coiled cables around a wafer receiver; a migration salad visibly marches across several plates in seasonal formations. Never rely on the dish name, invisible flavor, ordinary ingredients, typography, letters, signage, or captions to communicate the concept.

Return ONLY valid JSON shaped exactly like {"dishes":[{"name":string,"description":string,"price":string,"category":string,"warning":string,"emoji":string,"ingredients":string[3],"imagePrompt":string}]}.`;

function menuResponseFormat(count: number) {
  const stringField = { type: "string" };
  return {
    type: "json_schema",
    json_schema: {
      name: "infinite_cheesecake_menu",
      strict: true,
      schema: {
        type: "object",
        properties: {
          dishes: {
            type: "array",
            minItems: count,
            maxItems: count,
            items: {
              type: "object",
              properties: {
                name: stringField,
                description: stringField,
                price: stringField,
                category: stringField,
                warning: stringField,
                emoji: stringField,
                ingredients: { type: "array", minItems: 3, maxItems: 3, items: stringField },
                imagePrompt: stringField,
              },
              required: ["name", "description", "price", "category", "warning", "emoji", "ingredients", "imagePrompt"],
              additionalProperties: false,
            },
          },
        },
        required: ["dishes"],
        additionalProperties: false,
      },
    },
  };
}

function topicSource(topic: Topic) {
  return {
    title: topic.title,
    url: topic.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.title.replace(/ /g, "_"))}`,
  };
}

function finishDishes(dishes: ChefDish[], topicPairs: Array<[Topic, Topic]>, offset: number, expectedCount: number) {
  if (!Array.isArray(dishes) || dishes.length !== expectedCount) return null;
  return dishes.map((dish, index) => ({
    ...dish,
    id: `ai-${offset + index}-${Math.random().toString(36).slice(2, 8)}`,
    source: topicSource(topicPairs[index][0]),
    secondarySource: topicSource(topicPairs[index][1]),
  }));
}

function parseChefJson(text: string) {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) throw new Error("No JSON object found");
  return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as { dishes: ChefDish[] };
}

function preview(value: string) {
  return value.replace(/\s+/g, " ").slice(0, 600);
}

type ChefResult = { dishes: Dish[] } | { error: string };

async function askGeminiChef(topicPairs: Array<[Topic, Topic]>, seed: string, offset: number, count: number): Promise<ChefResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "GEMINI_API_KEY is not configured" };
  const baseUrl = (process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/$/, "");
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept-Language": "en-US,en",
  };

  try {
    const startedAt = Date.now();
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(75000),
      body: JSON.stringify({
        model,
        temperature: 1.25,
        top_p: 0.95,
        response_format: menuResponseFormat(count),
        max_tokens: 2000,
        messages: [
          { role: "system", content: chefInstructions },
          {
            role: "user",
            content: `Factory seed: ${seed}. Generate exactly ${count} unique menu items for menu positions ${offset + 1} through ${offset + count}; do not put position numbers in their names. Use these pairs in this exact order: ${JSON.stringify(topicPairs.map(([seedA, seedB], index) => ({ dish: index + 1, seedA, seedB })))}`,
          },
        ],
      }),
    });
    const responseText = await response.text();
    const responseMeta = {
      model,
      status: response.status,
      contentType: response.headers.get("content-type"),
      requestId: response.headers.get("x-request-id") || response.headers.get("request-id") || undefined,
      elapsedMs: Date.now() - startedAt,
    };
    if (!response.ok) {
      console.error("[gemini-menu] HTTP failure", { ...responseMeta, bodyPreview: preview(responseText) });
      return { error: `chat completion returned HTTP ${response.status}${responseMeta.requestId ? ` (request ${responseMeta.requestId})` : ""}` };
    }
    let data: {
      choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    try {
      data = JSON.parse(responseText) as typeof data;
    } catch {
      console.error("[gemini-menu] non-JSON response", { ...responseMeta, bodyPreview: preview(responseText) });
      return { error: `chat completion returned ${responseMeta.contentType || "a non-JSON response"}${responseMeta.requestId ? ` (request ${responseMeta.requestId})` : ""}` };
    }
    const outputText = data.choices?.[0]?.message?.content;
    const completionMeta = {
      ...responseMeta,
      finishReason: data.choices?.[0]?.finish_reason,
      usage: data.usage,
    };
    if (!outputText) {
      console.error("[gemini-menu] missing message content", { ...completionMeta, bodyPreview: preview(responseText) });
      return { error: "chat completion returned no message content" };
    }
    let parsed: { dishes: ChefDish[] };
    try {
      parsed = parseChefJson(outputText);
    } catch {
      console.error("[gemini-menu] invalid chef JSON", {
        ...completionMeta,
        outputPreview: preview(outputText),
        outputEndPreview: preview(outputText.slice(-600)),
      });
      return { error: "chat completion returned invalid JSON" };
    }
    const dishes = finishDishes(parsed.dishes, topicPairs, offset, count);
    if (!dishes) {
      console.error("[gemini-menu] wrong dish count", { ...completionMeta, expected: count, received: parsed.dishes?.length ?? 0 });
      return { error: `chat completion returned ${parsed.dishes?.length ?? 0} items instead of ${count}` };
    }
    console.info("[gemini-menu] success", { ...completionMeta, dishes: dishes.length, offset });
    return { dishes };
  } catch (error) {
    console.error("[gemini-menu] request exception", {
      model,
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    });
    return { error: error instanceof Error ? error.message : "connection failed" };
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Sign in to ask the chef for more dishes." }, { status: 401, headers: noStoreHeaders() });
  }
  if (!process.env.GEMINI_API_KEY || !process.env.DISH_TOKEN_SECRET) {
    return Response.json({ error: "The menu kitchen is not fully configured." }, { status: 503, headers: noStoreHeaders() });
  }

  try {
    const quota = await reserveQuota(user, "menu");
    if (!quota.ok) {
      const message = quota.reason === "global"
        ? "The factory has reached its safety limit for today. Please return tomorrow."
        : "You have reached today’s menu quota. It resets at midnight UTC.";
      return Response.json({ error: message }, { status: 429, headers: noStoreHeaders({ "Retry-After": "3600" }) });
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Quota service is unavailable." },
      { status: 503, headers: noStoreHeaders() },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { seed?: string; offset?: number; visitor?: string };
  const seed = String(body.seed || "the default timeline").slice(0, 100);
  const visitor = String(body.visitor || crypto.randomUUID()).slice(0, 100);
  const personalizedSeed = `${seed} · timeline ${hashSeed(visitor).toString(36)}`;
  const offset = Number.isFinite(body.offset) ? Number(body.offset) : 0;
  let topics: Topic[];
  try {
    topics = sampleWikipediaConcepts(BATCH_SIZE * 2, personalizedSeed, offset);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Local Wikipedia concept sampling failed." }, { status: 500 });
  }

  const topicPairs = pairWikipediaConcepts(topics);
  const result = await askGeminiChef(topicPairs, personalizedSeed, offset, BATCH_SIZE);
  if ("error" in result) {
    return Response.json({ error: `Gemini menu generation failed: ${result.error}.` }, { status: 502, headers: noStoreHeaders() });
  }

  const dishes = await Promise.all(result.dishes.map(async (dish) => ({ ...dish, imageToken: await signDish(dish, user.id) })));

  await recordGeneration(user, "menu", dishes.length).catch((error) => {
    console.error("[analytics] unable to record menu generation", error);
  });

  return Response.json({
    dishes,
    chef: "gemini",
    source: "wikipedia",
    inspirations: topics,
  }, { headers: noStoreHeaders() });
}
