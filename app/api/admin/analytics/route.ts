import { analyticsSnapshot } from "../../../../lib/analytics";
import { getAuthenticatedUser, noStoreHeaders } from "../../../../lib/auth";
import { requireAdmin } from "../../../../lib/quota";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Sign in required." }, { status: 401, headers: noStoreHeaders() });
  }
  if (!(await requireAdmin(user))) {
    return Response.json({ error: "Admin access required." }, { status: 403, headers: noStoreHeaders() });
  }

  return Response.json(await analyticsSnapshot(), { headers: noStoreHeaders() });
}
