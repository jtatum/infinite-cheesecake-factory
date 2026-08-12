import { getAuthenticatedUser, noStoreHeaders } from "../../../../lib/auth";
import { listUsers, requireAdmin, setUserRole, type UserRole } from "../../../../lib/quota";

async function authorizedAdmin() {
  const user = await getAuthenticatedUser();
  if (!user) return { error: Response.json({ error: "Sign in required." }, { status: 401, headers: noStoreHeaders() }) };
  if (!(await requireAdmin(user))) {
    return { error: Response.json({ error: "Admin access required." }, { status: 403, headers: noStoreHeaders() }) };
  }
  return { user };
}

export async function GET() {
  const auth = await authorizedAdmin();
  if ("error" in auth) return auth.error;
  return Response.json({ users: await listUsers() }, { headers: noStoreHeaders() });
}

export async function PATCH(request: Request) {
  const auth = await authorizedAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { userId?: string; role?: string };
  const roles: UserRole[] = ["user", "trusted", "admin"];
  if (!body.userId || !roles.includes(body.role as UserRole)) {
    return Response.json({ error: "A valid user and role are required." }, { status: 400, headers: noStoreHeaders() });
  }
  const user = await setUserRole(body.userId, body.role as UserRole);
  if (!user) return Response.json({ error: "User not found." }, { status: 404, headers: noStoreHeaders() });
  return Response.json({ user }, { headers: noStoreHeaders() });
}
