import type { Dish } from "./menu";

type DishClaims = {
  userId: string;
  expiresAt: number;
  dish: Pick<Dish, "name" | "description" | "category" | "ingredients" | "imagePrompt">;
};

function encode(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey() {
  const secret = process.env.DISH_TOKEN_SECRET;
  if (!secret) throw new Error("DISH_TOKEN_SECRET is not configured.");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signDish(dish: Dish, userId: string) {
  const claims: DishClaims = {
    userId,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    dish: {
      name: dish.name,
      description: dish.description,
      category: dish.category,
      ingredients: dish.ingredients,
      imagePrompt: dish.imagePrompt,
    },
  };
  const payload = encode(JSON.stringify(claims));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}

export async function verifyDishToken(token: string, userId: string) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(),
    decode(signature),
    new TextEncoder().encode(payload),
  );
  if (!valid) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(decode(payload))) as DishClaims;
    if (claims.userId !== userId || claims.expiresAt < Date.now()) return null;
    if (!claims.dish?.name || !claims.dish.imagePrompt || !Array.isArray(claims.dish.ingredients)) return null;
    return claims.dish;
  } catch {
    return null;
  }
}
