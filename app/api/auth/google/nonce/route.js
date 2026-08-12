import { createGoogleNonce, googleClientId, googleNonceCookie } from "../../../../../src/server/google-auth.js";

export async function GET() {
  if (!googleClientId()) return Response.json({ ok: false, reason: "google_not_configured" }, { status: 503 });
  const challenge = createGoogleNonce();
  return Response.json(
    { ok: true, nonce: challenge.nonce },
    { headers: { "Set-Cookie": googleNonceCookie(challenge.digest), "Cache-Control": "no-store" } }
  );
}
