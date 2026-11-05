import { mutationOriginResponse } from "../../../../src/shared/request-origin.js";
import { auditAdmin, getAdminContext } from "../../../../src/server/admin-auth.js";
import { ADMIN_SESSION_COOKIE, clearAdminSessionCookie, destroySession } from "../../../../src/server/session.js";
import { adminPageUrl } from "../../../../src/server/app-url.js";

export async function POST(request) {
  const originDenied = mutationOriginResponse(request);
  if (originDenied) return originDenied;
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearAdminSessionCookie());
  const admin = await getAdminContext(request).catch(() => null);
  let sessionRevoked = true;
  try {
    await destroySession(request, { cookieName: ADMIN_SESSION_COOKIE });
  } catch {
    sessionRevoked = false;
  }
  if (admin) {
    await auditAdmin(request, {
      admin,
      action: "admin.logout",
      resource: "admin_portal"
    }).catch(() => undefined);
  }
  return Response.json(
    { ok: true, sessionRevoked, redirectUrl: adminPageUrl("/advanced-pro-control") },
    { headers }
  );
}
