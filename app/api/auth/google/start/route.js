import { createGoogleNonce, googleClientId, googleNonceCookie } from "../../../../../src/server/google-auth.js";
import { createGoogleOAuthChallenge, googleOAuthAuthorizationUrl, googleOAuthChallengeCookies } from "../../../../../src/server/google-oauth.js";

export async function GET(req) {
  if (!googleClientId() || !String(process.env.GOOGLE_CLIENT_SECRET || "").trim()) return Response.redirect(new URL("/login?google_error=not_configured", req.url), 302);
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") === "en" ? "en" : "ar";
  const oauth = createGoogleOAuthChallenge();
  const nonce = createGoogleNonce();
  const headers = new Headers({ Location: googleOAuthAuthorizationUrl({ state: oauth.state, nonce: nonce.nonce, challenge: oauth.challenge, locale }), "Cache-Control": "no-store" });
  [...googleOAuthChallengeCookies(oauth), googleNonceCookie(nonce.digest)].forEach((cookie) => headers.append("Set-Cookie", cookie));
  return new Response(null, { status: 302, headers });
}
