import { authenticateGoogle, clearGoogleNonceCookie, readGoogleNonceDigest, verifyGoogleCredential } from "../../../../../src/server/google-auth.js";
import { clearGoogleOAuthChallengeCookies, exchangeGoogleAuthorizationCode, googleOAuthStateMatches, readGoogleOAuthChallenge } from "../../../../../src/server/google-oauth.js";
import { sessionCookie } from "../../../../../src/server/session.js";
import { challengeCookie, readTrustedBrowserCookie } from "../../../../../src/server/email-otp-v2.js";
import { mfaChallengeCookie } from "../../../../../src/server/login-mfa.js";
import { isRenderAuthRuntime } from "../../../../../src/server/auth-backend-runtime.js";

function configuredOrigin(value, fallback) { return value ? new URL(value).origin : fallback; }
function authOrigin(req) { return configuredOrigin(process.env.AUTH_URL || process.env.BETTER_AUTH_URL, new URL(req.url).origin); }
function appOrigin(req) { return configuredOrigin(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL, new URL(req.url).origin); }
function redirectWithCookies(location, cookies) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  [...clearGoogleOAuthChallengeCookies(), clearGoogleNonceCookie(), ...cookies.filter(Boolean)].forEach((cookie) => headers.append("Set-Cookie", cookie));
  return new Response(null, { status: 302, headers });
}
function failure(req, reason, intent = "login") {
  const target = new URL(intent === "register" ? "/register" : "/login", authOrigin(req));
  target.searchParams.set("google_error", reason);
  return redirectWithCookies(target.toString(), []);
}

export async function GET(req) {
  const challenge = readGoogleOAuthChallenge(req);
  if (!isRenderAuthRuntime()) return failure(req, "auth_backend_required", challenge.intent);
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return failure(req, "cancelled", challenge.intent);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (!code || !challenge.verifier || !googleOAuthStateMatches(state, challenge.stateDigest)) return failure(req, "invalid_state", challenge.intent);
  try {
    const exchanged = await exchangeGoogleAuthorizationCode({ code, verifier: challenge.verifier });
    if (!exchanged.ok) return failure(req, exchanged.reason, challenge.intent);
    const verified = await verifyGoogleCredential({ credential: exchanged.idToken, expectedNonceDigest: readGoogleNonceDigest(req) });
    if (!verified.ok) return failure(req, verified.reason, challenge.intent);
    const result = await authenticateGoogle({ profile: verified.profile, intent: challenge.intent, ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(), userAgent: req.headers.get("user-agent"), trustedDeviceToken: readTrustedBrowserCookie(req), locale: "ar" });
    if (!result.ok) return failure(req, result.reason, challenge.intent);
    if (result.requiresMfa) return redirectWithCookies(`${authOrigin(req)}/verify-mfa`, [mfaChallengeCookie(result.challenge.challengeCookie)]);
    if (result.requiresEmailOtp) return redirectWithCookies(`${authOrigin(req)}/verify-email`, [challengeCookie(result.challenge.challengeCookie)]);
    return redirectWithCookies(`${appOrigin(req)}/dashboard`, [sessionCookie(result.session.token)]);
  } catch (error) {
    console.error("google oauth callback failed", { code: String(error?.code || "GOOGLE_OAUTH_CALLBACK_ERROR") });
    return failure(req, "unavailable", challenge.intent);
  }
}
