import crypto from "node:crypto";
import { secureCookieEnabled, sharedCookieDomainAttribute } from "./cookie-policy.js";
import { googleClientId, normalizeGoogleAuthIntent } from "./google-auth.js";
import { randomToken, sha256 } from "./security.js";

export const GOOGLE_OAUTH_STATE_COOKIE = "renvix_google_oauth_state";
export const GOOGLE_OAUTH_VERIFIER_COOKIE = "renvix_google_oauth_verifier";
export const GOOGLE_OAUTH_INTENT_COOKIE = "renvix_google_oauth_intent";
const OAUTH_CHALLENGE_AGE_SECONDS = 10 * 60;

function cookieValue(req, name) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function oauthCookie(name, value, maxAge = OAUTH_CHALLENGE_AGE_SECONDS) {
  const secure = secureCookieEnabled() ? "; Secure" : "";
  const domain = sharedCookieDomainAttribute();
  return `${name}=${encodeURIComponent(value || "")}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Number(maxAge) || 0)}${domain}${secure}`;
}

export function googleOAuthRedirectUri() {
  // The Google Cloud client is registered against the public accounts portal.
  // Middleware forwards this callback to Render, where the secret exchange runs.
  const configured = process.env.AUTH_URL || process.env.BETTER_AUTH_URL || process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "";
  const origin = configured ? new URL(configured).origin : "http://localhost:3000";
  return `${origin}/api/auth/google/callback`;
}

export function createGoogleOAuthChallenge() {
  const state = randomToken(32);
  const verifier = randomToken(48);
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { state, stateDigest: sha256(state), verifier, challenge };
}

export function googleOAuthChallengeCookies(challenge, intent = "login") {
  return [
    oauthCookie(GOOGLE_OAUTH_STATE_COOKIE, challenge.stateDigest),
    oauthCookie(GOOGLE_OAUTH_VERIFIER_COOKIE, challenge.verifier),
    oauthCookie(GOOGLE_OAUTH_INTENT_COOKIE, normalizeGoogleAuthIntent(intent))
  ];
}

export function clearGoogleOAuthChallengeCookies() {
  return [
    oauthCookie(GOOGLE_OAUTH_STATE_COOKIE, "", 0),
    oauthCookie(GOOGLE_OAUTH_VERIFIER_COOKIE, "", 0),
    oauthCookie(GOOGLE_OAUTH_INTENT_COOKIE, "", 0)
  ];
}

export function readGoogleOAuthChallenge(req) {
  return {
    stateDigest: cookieValue(req, GOOGLE_OAUTH_STATE_COOKIE),
    verifier: cookieValue(req, GOOGLE_OAUTH_VERIFIER_COOKIE),
    intent: normalizeGoogleAuthIntent(cookieValue(req, GOOGLE_OAUTH_INTENT_COOKIE))
  };
}

export function googleOAuthStateMatches(state, expectedDigest) {
  if (!state || !expectedDigest) return false;
  const actual = Buffer.from(sha256(state));
  const expected = Buffer.from(String(expectedDigest));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function googleOAuthAuthorizationUrl({ state, nonce, challenge, locale = "ar" }) {
  const params = new URLSearchParams({ client_id: googleClientId(), redirect_uri: googleOAuthRedirectUri(), response_type: "code", scope: "openid email profile", state, nonce, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account", include_granted_scopes: "true", hl: locale === "en" ? "en" : "ar" });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleAuthorizationCode({ code, verifier, fetcher = fetch }) {
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
  const clientId = googleClientId();
  if (!clientId || !clientSecret) return { ok: false, status: 503, reason: "google_not_configured" };
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: googleOAuthRedirectUri(), grant_type: "authorization_code", code_verifier: verifier }),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.id_token) return { ok: false, status: 401, reason: "google_code_exchange_failed" };
  return { ok: true, idToken: payload.id_token };
}
