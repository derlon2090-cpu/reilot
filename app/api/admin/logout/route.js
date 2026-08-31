import { auditAdmin, getAdminContext } from "../../../../src/server/admin-auth.js";
import { ADMIN_SESSION_COOKIE, clearAdminSessionCookie, destroySession } from "../../../../src/server/session.js";
import { adminPageUrl } from "../../../../src/server/app-url.js";

export async function POST(request) {
  const admin = await getAdminContext(request).catch(() => null);
  if (admin) {
    await auditAdmin(request, {
      admin,
      action: "admin.logout",
      resource: "admin_portal"
    });
  }
  await destroySession(request, { cookieName: ADMIN_SESSION_COOKIE });
  return Response.json(
    { ok: true, redirectUrl: adminPageUrl("/advanced-pro-control") },
    { headers: { "Set-Cookie": clearAdminSessionCookie() } }
  );
}
