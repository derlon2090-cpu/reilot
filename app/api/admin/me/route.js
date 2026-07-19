import { getAdminContext } from "../../../../src/server/admin-auth.js";

export async function GET(request) {
  const admin = await getAdminContext(request).catch(() => null);
  if (!admin) {
    return Response.json({ ok: false, reason: "admin_auth_required" }, { status: 401 });
  }
  return Response.json({
    ok: true,
    admin: {
      name: admin.name,
      email: admin.email,
      role: admin.adminRole
    }
  });
}
