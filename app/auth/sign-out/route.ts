import { createSupabaseClient, hasSupabaseConfig, noStoreHeaders } from "../../../lib/auth";

export async function POST(request: Request) {
  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseClient();
    await supabase.auth.signOut();
  }
  const headers = noStoreHeaders({ Location: new URL("/", request.url).toString() });
  return new Response(null, { status: 303, headers });
}
