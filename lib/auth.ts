import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
};

export function authProviders() {
  const supported = new Set(["google", "github"]);
  const configured = (process.env.AUTH_PROVIDERS || "google")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider) => supported.has(provider));
  return configured.length ? configured : ["google"];
}

export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}

export async function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Supabase authentication is not configured.");

  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options as CookieOptions);
        }
      },
    },
  });
}

function displayName(user: User) {
  const metadataName = user.user_metadata?.full_name || user.user_metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();
  return user.email || "Restaurant guest";
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email, displayName: displayName(data.user) };
}

export function noStoreHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  return headers;
}

export function safeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    return url.origin === "https://app.local" ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
