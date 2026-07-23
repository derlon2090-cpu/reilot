import { requestIp } from "../../../../../src/server/admin-auth.js";
import {
  allowLocalAdminSetup,
  adminSetupAccessCookie,
  adminSetupCsrfCookie,
  consumeAdminSetupRateLimit,
  getAdminSetupState,
  issueAdminSetupAccessToken,
  issueAdminSetupCsrfToken,
  verifyAdminSetupAccess,
  verifyAdminSetupToken
} from "../../../../../src/server/admin-setup.js";
import { safeErrorMessage, sha256 } from "../../../../../src/server/security.js";

export const runtime = "nodejs";

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const tokenAuthorized = verifyAdminSetupToken(token);
  if (!tokenAuthorized && !verifyAdminSetupAccess(request) && !allowLocalAdminSetup(request)) {
    return Response.json({ ok: false, reason: "invalid_setup_link" }, { status: 404 });
  }

  const limited = consumeAdminSetupRateLimit(`status:${sha256(requestIp(request))}`, { limit: 20, windowMs: 10 * 60 * 1000 });
  if (!limited.ok) return Response.json({ ok: false, reason: "rate_limited", retryAfterSeconds: limited.retryAfterSeconds }, { status: 429 });

  try {
    const state = await getAdminSetupState();
    if (state.configured) {
      return Response.json({ ok: true, state: "configured", message: "تم إعداد حساب المسؤول مسبقًا" }, {
        status: 409,
        headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
      });
    }
    const csrfToken = issueAdminSetupCsrfToken();
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer"
    });
    headers.append("Set-Cookie", adminSetupCsrfCookie(csrfToken));
    if (tokenAuthorized) headers.append("Set-Cookie", adminSetupAccessCookie(issueAdminSetupAccessToken()));
    return Response.json({ ok: true, state: "ready", csrfToken }, {
      headers
    });
  } catch (error) {
    console.error("admin setup status unavailable", safeErrorMessage(error));
    return Response.json({ ok: false, reason: "database_unavailable", message: "تعذر الاتصال بقاعدة البيانات، تحقق من إعداد DATABASE_URL" }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
    });
  }
}
