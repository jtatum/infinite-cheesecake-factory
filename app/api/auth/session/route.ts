import { authProviders, getAuthenticatedUser, hasSupabaseConfig, noStoreHeaders } from "../../../../lib/auth";
import { usageSnapshot } from "../../../../lib/quota";

export async function GET() {
  const configured = hasSupabaseConfig();
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json(
      { configured, providers: authProviders(), user: null },
      { headers: noStoreHeaders() },
    );
  }

  try {
    const quota = await usageSnapshot(user);
    return Response.json(
      { configured, providers: authProviders(), user, quota },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Account state is unavailable." },
      { status: 503, headers: noStoreHeaders() },
    );
  }
}
