import { createGoogleNonce, googleClientId, googleNonceCookie } from "../../../../../src/server/google-auth.js";
import { createGoogleOAuthChallenge, googleOAuthAuthorizationUrl, googleOAuthChallengeCookies } from "../../../../../src/server/google-oauth.js";

export async function GET(req) {
  const missingClientId = !googleClientId();
  const missingClientSecret = !String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
  if (missingClientId || missingClientSecret) {
    // Expose only the missing variable name for deployment diagnostics; never its value.
    const target = new URL("/login", req.url);
    target.searchParams.set("google_error", missingClientId ? "missing_client_id" : "missing_client_secret");
    return Response.redirect(target, 302);
  }
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") === "en" ? "en" : "ar";
  const oauth = createGoogleOAuthChallenge();
  const nonce = createGoogleNonce();
  const headers = new Headers({ Location: googleOAuthAuthorizationUrl({ state: oauth.state, nonce: nonce.nonce, challenge: oauth.challenge, locale }), "Cache-Control": "no-store" });
  [...googleOAuthChallengeCookies(oauth), googleNonceCookie(nonce.digest)].forEach((cookie) => headers.append("Set-Cookie", cookie));
  return new Response(null, { status: 302, headers });
}
