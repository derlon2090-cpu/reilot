import { loginAccount } from "../../../../src/server/auth-actions.js";
import { isValidEmail, normalizeEmail, safeErrorMessage, safeErrorStack } from "../../../../src/server/security.js";
import { sessionCookie } from "../../../../src/server/session.js";
import {
  TRUSTED_DEVICE_COOKIE,
  challengeCookie,
  readCookie
} from "../../../../src/server/email-otp.js";
import { mfaChallengeCookie } from "../../../../src/server/login-mfa.js";

export function classifyAuthFailure(error) {
  const code = String(error?.code || "");
  const stage = String(error?.authStage || "unknown");
  if (["42P01", "42703", "28P01", "3D000"].includes(code) || code.startsWith("08")) {
    return { reason: "auth_database_error", status: 503, stage, code };
  }
  if (stage === "session_creation") return { reason: "auth_session_error", status: 503, stage, code };
  if (code === "AUTH_CONFIGURATION_ERROR") return { reason: "auth_configuration_error", status: 503, stage, code };
  return { reason: "server_error", status: 500, stage, code };
}

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
    if (result.requiresMfa) {
      return Response.json(
        {
          ok: true,
          requiresMfa: true,
          expiresAt: result.challenge.expiresAt,
          attemptsRemaining: 5
        },
        {
          status: 202,
          headers: { "Set-Cookie": mfaChallengeCookie(result.challenge.challengeCookie) }
        }
      );
    }
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
    const failure = classifyAuthFailure(error);
    console.error("login failed", {
      stage: failure.stage,
      code: failure.code || "unknown",
      message: safeErrorMessage(error),
      stack: safeErrorStack(error)
    });
    return Response.json({ ok: false, reason: failure.reason }, { status: failure.status });
  }
}
