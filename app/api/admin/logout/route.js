import { auditAdmin, getAdminContext } from "../../../../src/server/admin-auth.js";
import { clearSessionCookie, destroySession } from "../../../../src/server/session.js";

export async function POST(request) {
  const admin = await getAdminContext(request).catch(() => null);
  if (admin) {
    await auditAdmin(request, {
      admin,
      action: "admin.logout",
      resource: "admin_portal"
    });
  }
  await destroySession(request);
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookie() } }
  );
}
