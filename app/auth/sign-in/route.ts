import type { Provider } from "@supabase/supabase-js";
import { authProviders, createSupabaseClient, hasSupabaseConfig, noStoreHeaders, safeReturnPath } from "../../../lib/auth";

export async function GET(request: Request) {
  if (!hasSupabaseConfig()) {
    return new Response("Authentication is not configured yet.", { status: 503, headers: noStoreHeaders() });
  }

  const requestUrl = new URL(request.url);
  const provider = (requestUrl.searchParams.get("provider") || "google").toLowerCase();
  if (!authProviders().includes(provider)) {
    return new Response("That sign-in provider is not enabled.", { status: 400, headers: noStoreHeaders() });
  }

  const returnTo = safeReturnPath(requestUrl.searchParams.get("returnTo"));
  const callback = new URL("/auth/callback", requestUrl.origin);
  callback.searchParams.set("returnTo", returnTo);
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: { redirectTo: callback.toString() },
  });

  if (error || !data.url) {
    const target = new URL(returnTo, requestUrl.origin);
    target.searchParams.set("auth_error", error?.message || "Unable to begin sign-in.");
    return Response.redirect(target, 303);
  }
  return Response.redirect(data.url, 303);
}
