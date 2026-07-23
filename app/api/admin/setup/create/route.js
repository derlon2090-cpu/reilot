import {
  AdminSetupError,
  ADMIN_SETUP_ACCESS_COOKIE,
  ADMIN_SETUP_CSRF_COOKIE,
  consumeAdminSetupRateLimit,
  createFirstAdmin,
  validateAdminSetupInput,
  verifyAdminSetupAccess,
  verifyAdminSetupCsrf,
  verifyAdminSetupToken,
  verifySameOrigin
} from "../../../../../src/server/admin-setup.js";
import { requestIp } from "../../../../../src/server/admin-auth.js";
import { safeErrorMessage, sha256 } from "../../../../../src/server/security.js";
import { sessionCookie } from "../../../../../src/server/session.js";

export const runtime = "nodejs";

function responseJson(payload, status = 200, headers = {}, cookies = []) {
  const responseHeaders = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...headers });
  for (const cookie of cookies) responseHeaders.append("Set-Cookie", cookie);
  return Response.json(payload, {
    status,
    headers: responseHeaders
  });
}

export async function POST(request) {
  const token = request.headers.get("x-admin-setup-token") || "";
  if (!verifyAdminSetupToken(token) && !verifyAdminSetupAccess(request)) {
    return responseJson({ ok: false, reason: "invalid_setup_link" }, 404);
  }
  if (!verifySameOrigin(request)) return responseJson({ ok: false, reason: "csrf_failed", message: "تعذر التحقق من مصدر الطلب." }, 403);
  if (!verifyAdminSetupCsrf(request)) return responseJson({ ok: false, reason: "csrf_failed", message: "انتهت جلسة الإعداد. أعد فتح رابط الإعداد." }, 403);

  const limited = consumeAdminSetupRateLimit(`create:${sha256(requestIp(request))}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!limited.ok) return responseJson({ ok: false, reason: "rate_limited", retryAfterSeconds: limited.retryAfterSeconds }, 429);

  const input = await request.json().catch(() => ({}));
  const parsed = validateAdminSetupInput(input);
  if (!parsed.ok) return responseJson({ ok: false, reason: "validation_error", errors: parsed.errors }, 400);

  try {
    const created = await createFirstAdmin({
      ...input,
      ipAddress: requestIp(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 500) || null
    });
    return responseJson({ ok: true, message: "تم إنشاء حساب المسؤول بنجاح", redirectUrl: "/admin" }, 201, {}, [
      sessionCookie(created.session.token, 60 * 60 * 12),
      `${ADMIN_SETUP_ACCESS_COOKIE}=; Path=/api/admin/setup; HttpOnly; SameSite=Strict; Max-Age=0`,
      `${ADMIN_SETUP_CSRF_COOKIE}=; Path=/api/admin/setup; HttpOnly; SameSite=Strict; Max-Age=0`
    ]);
  } catch (error) {
    if (error instanceof AdminSetupError) {
      const status = error.code === "already_configured" ? 409 : error.code === "email_in_use" ? 409 : 400;
      return responseJson({ ok: false, reason: error.code, message: error.message }, status);
    }
    console.error("admin setup create unavailable", safeErrorMessage(error));
    return responseJson({ ok: false, reason: "database_unavailable", message: "تعذر الاتصال بقاعدة البيانات، تحقق من إعداد DATABASE_URL" }, 503);
  }
}
