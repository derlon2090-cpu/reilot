import { authenticateGoogle, clearGoogleNonceCookie, normalizeGoogleAuthIntent, readGoogleNonceDigest, verifyGoogleCredential } from "../../../../src/server/google-auth.js";
import { sessionCookie } from "../../../../src/server/session.js";
import { challengeCookie, readTrustedBrowserCookie } from "../../../../src/server/email-otp-v2.js";
import { mfaChallengeCookie } from "../../../../src/server/login-mfa.js";
import { authCorsHeaders, authCorsPreflight, authOriginAllowed } from "../../../../src/server/auth-cors.js";
import { authBackendUnavailableResponse, isRenderAuthRuntime } from "../../../../src/server/auth-backend-runtime.js";

function appendCookies(headers, cookies) {
  cookies.filter(Boolean).forEach((cookie) => headers.append("Set-Cookie", cookie));
  return headers;
}

export async function POST(req) {
  if (!isRenderAuthRuntime()) return authBackendUnavailableResponse();
  if (!authOriginAllowed(req)) return Response.json({ ok: false, reason: "origin_not_allowed" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  const intent = normalizeGoogleAuthIntent(body.intent);
  const verified = await verifyGoogleCredential({ credential: body.credential, expectedNonceDigest: readGoogleNonceDigest(req) });
  const baseHeaders = new Headers({ ...authCorsHeaders(req), "Cache-Control": "no-store" });
  baseHeaders.append("Set-Cookie", clearGoogleNonceCookie());
  if (!verified.ok) return Response.json({ ok: false, reason: verified.reason }, { status: verified.status, headers: baseHeaders });
  try {
    const result = await authenticateGoogle({
      profile: verified.profile,
      intent,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent"),
      trustedDeviceToken: readTrustedBrowserCookie(req),
      locale: body.locale === "en" ? "en" : "ar"
    });
    if (!result.ok) return Response.json({ ok: false, reason: result.reason, intent }, { status: result.status, headers: baseHeaders });
    if (result.requiresMfa) {
      appendCookies(baseHeaders, [mfaChallengeCookie(result.challenge.challengeCookie)]);
      return Response.json({ ok: true, requiresMfa: true, expiresAt: result.challenge.expiresAt, attemptsRemaining: 5, user: result.user, intent }, { status: 202, headers: baseHeaders });
    }
    if (result.requiresEmailOtp) {
      appendCookies(baseHeaders, [challengeCookie(result.challenge.challengeCookie)]);
      return Response.json({ ok: true, requiresEmailOtp: true, maskedEmail: result.challenge.maskedEmail, expiresAt: result.challenge.expiresAt, resendAt: result.challenge.resendAt, user: result.user, intent }, { status: 202, headers: baseHeaders });
    }
    appendCookies(baseHeaders, [sessionCookie(result.session.token)]);
    return Response.json({ ok: true, user: result.user, created: result.created, linked: result.linked, intent }, { status: result.status, headers: baseHeaders });
  } catch (error) {
    console.error("google authentication failed", { code: String(error?.code || "GOOGLE_AUTH_ERROR") });
    return Response.json({ ok: false, reason: "google_auth_unavailable" }, { status: 503, headers: baseHeaders });
  }
}

export async function OPTIONS(req) {
  return authCorsPreflight(req, "POST, OPTIONS");
}
