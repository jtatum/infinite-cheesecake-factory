import { createSupabaseClient, hasSupabaseConfig, safeReturnPath } from "../../../lib/auth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = safeReturnPath(requestUrl.searchParams.get("returnTo"));
  const target = new URL(returnTo, requestUrl.origin);
  const code = requestUrl.searchParams.get("code");

  if (!hasSupabaseConfig() || !code) {
    target.searchParams.set("auth_error", "The sign-in callback was incomplete.");
    return Response.redirect(target, 303);
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) target.searchParams.set("auth_error", error.message);
  return Response.redirect(target, 303);
}
