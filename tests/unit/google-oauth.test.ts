import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGoogleOAuthChallenge, exchangeGoogleAuthorizationCode, googleOAuthAuthorizationUrl, googleOAuthChallengeCookies, googleOAuthStateMatches, readGoogleOAuthChallenge } from "../../src/server/google-oauth.js";

const original = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  API_PUBLIC_URL: process.env.API_PUBLIC_URL
};

describe("Google OAuth redirect fallback", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "web-client.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "server-only-secret";
    process.env.AUTH_URL = "https://accounts.renvix.app";
    process.env.API_PUBLIC_URL = "https://api.renvix.app";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("binds the redirect to state, nonce, PKCE and the Render callback", () => {
    const challenge = createGoogleOAuthChallenge();
    expect(googleOAuthStateMatches(challenge.state, challenge.stateDigest)).toBe(true);
    expect(googleOAuthStateMatches("attacker-state", challenge.stateDigest)).toBe(false);
    const url = new URL(googleOAuthAuthorizationUrl({ state: challenge.state, nonce: "nonce", challenge: challenge.challenge }));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("redirect_uri")).toBe("https://api.renvix.app/api/auth/google/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("nonce")).toBe("nonce");
  });

  it("preserves registration intent in an HttpOnly callback cookie", () => {
    const challenge = createGoogleOAuthChallenge();
    const cookies = googleOAuthChallengeCookies(challenge, "register");
    const request = new Request("https://api.renvix.app/api/auth/google/callback", {
      headers: { cookie: cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ") }
    });
    expect(cookies).toHaveLength(3);
    expect(cookies.every((cookie) => cookie.includes("HttpOnly"))).toBe(true);
    expect(readGoogleOAuthChallenge(request)).toMatchObject({
      stateDigest: challenge.stateDigest,
      verifier: challenge.verifier,
      intent: "register"
    });
  });

  it("exchanges the authorization code on the server using the PKCE verifier", async () => {
    let requestBody = "";
    const fetcher = async (_url: string, options: RequestInit) => {
      requestBody = String(options.body || "");
      return new Response(JSON.stringify({ id_token: "verified-id-token" }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const result = await exchangeGoogleAuthorizationCode({ code: "authorization-code", verifier: "pkce-verifier", fetcher: fetcher as typeof fetch });
    expect(result).toEqual({ ok: true, idToken: "verified-id-token" });
    const body = new URLSearchParams(requestBody);
    expect(body.get("code_verifier")).toBe("pkce-verifier");
    expect(body.get("redirect_uri")).toBe("https://api.renvix.app/api/auth/google/callback");
    expect(body.get("client_secret")).toBe("server-only-secret");
  });
});
