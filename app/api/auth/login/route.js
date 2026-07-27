import { loginAccount } from "../../../../src/server/auth-actions.js";
import { isValidEmail, normalizeEmail, safeErrorMessage } from "../../../../src/server/security.js";
import { sessionCookie } from "../../../../src/server/session.js";
import {
  TRUSTED_DEVICE_COOKIE,
  challengeCookie,
  readCookie
} from "../../../../src/server/email-otp.js";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return Response.json({ ok: false, reason: "invalid_request" }, { status: 400 });
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email) || !body.password) return Response.json({ ok: false, reason: "invalid_credentials" }, { status: 401 });
    const result = await loginAccount({
      email,
      password: body.password,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent"),
      trustedDeviceToken: readCookie(req, TRUSTED_DEVICE_COOKIE),
      locale: body.locale === "en" ? "en" : "ar"
    });
    if (!result.ok) return Response.json({ ok: false, reason: result.reason }, { status: result.status });
    if (result.requiresEmailOtp) {
      return Response.json(
        {
          ok: true,
          requiresEmailOtp: true,
          maskedEmail: result.challenge.maskedEmail,
          expiresAt: result.challenge.expiresAt,
          resendAt: result.challenge.resendAt
        },
        {
          status: 202,
          headers: { "Set-Cookie": challengeCookie(result.challenge.challengeCookie) }
        }
      );
    }
    return Response.json({ ok: true, user: result.user }, { headers: { "Set-Cookie": sessionCookie(result.session.token) } });
  } catch (error) {
    console.error("login failed", safeErrorMessage(error));
    return Response.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
