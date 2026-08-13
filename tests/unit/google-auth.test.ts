import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGoogleNonce, googleAuthIntentAllowsSignup, googleAutoLinkAllowed, googleClientId, googleEmailOtpRequired, normalizeGoogleAuthIntent, normalizeGoogleClientId, verifyGoogleCredential } from "../../src/server/google-auth.js";
import { sha256 } from "../../src/server/security.js";

const originalClientId = process.env.GOOGLE_CLIENT_ID;

function verifier(payload: Record<string, unknown>, error?: Error) {
  return {
    async verifyIdToken(options: { idToken: string; audience: string }) {
      expect(options.idToken).toBe("credential");
      expect(options.audience).toBe("web-client.apps.googleusercontent.com");
      if (error) throw error;
      return { getPayload: () => payload };
    }
  };
}

describe("Google identity verification", () => {
  beforeEach(() => { process.env.GOOGLE_CLIENT_ID = "web-client.apps.googleusercontent.com"; });
  afterEach(() => {
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalClientId;
  });

  it("creates an unpredictable nonce and stores only its digest", () => {
    const first = createGoogleNonce();
    const second = createGoogleNonce();
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.digest).toBe(sha256(first.nonce));
    expect(first.digest).not.toContain(first.nonce);
  });

  it("normalizes a legacy URL-prefixed client ID without accepting paths or arbitrary hosts", () => {
    process.env.GOOGLE_CLIENT_ID = "https://web-client.apps.googleusercontent.com/";
    expect(googleClientId()).toBe("web-client.apps.googleusercontent.com");
    expect(normalizeGoogleClientId("https://web-client.apps.googleusercontent.com/callback")).toBe("");
    expect(normalizeGoogleClientId("https://example.com")).toBe("");
  });

  it("accepts a verified Google token with the expected nonce and audience", async () => {
    const nonce = "nonce-value";
    const result = await verifyGoogleCredential({
      credential: "credential",
      expectedNonceDigest: sha256(nonce),
      verifier: verifier({ sub: "google-sub", email: "USER@GMAIL.COM", email_verified: true, nonce, name: "Renvix User", picture: "https://example.com/avatar.png" }) as never
    });
    expect(result).toMatchObject({ ok: true, profile: { subject: "google-sub", email: "user@gmail.com", name: "Renvix User" } });
  });

  it("rejects an invalid signature, audience, issuer, or expired token from the official verifier", async () => {
    const result = await verifyGoogleCredential({ credential: "credential", expectedNonceDigest: sha256("nonce"), verifier: verifier({}, new Error("invalid token")) as never });
    expect(result).toMatchObject({ ok: false, status: 401, reason: "google_token_invalid" });
  });

  it("rejects nonce reuse or login-CSRF mismatch", async () => {
    const result = await verifyGoogleCredential({
      credential: "credential",
      expectedNonceDigest: sha256("expected"),
      verifier: verifier({ sub: "subject", email: "user@gmail.com", email_verified: true, nonce: "different" }) as never
    });
    expect(result).toMatchObject({ ok: false, reason: "google_nonce_invalid" });
  });

  it("rejects Google identities without a verified email", async () => {
    const result = await verifyGoogleCredential({
      credential: "credential",
      expectedNonceDigest: sha256("nonce"),
      verifier: verifier({ sub: "subject", email: "user@gmail.com", email_verified: false, nonce: "nonce" }) as never
    });
    expect(result).toMatchObject({ ok: false, reason: "google_identity_invalid" });
  });
});

describe("Google account linking policy", () => {
  it("creates a new account only from an explicit registration flow", () => {
    expect(normalizeGoogleAuthIntent("register")).toBe("register");
    expect(normalizeGoogleAuthIntent("login")).toBe("login");
    expect(normalizeGoogleAuthIntent("unexpected")).toBe("login");
    expect(googleAuthIntentAllowsSignup("register")).toBe(true);
    expect(googleAuthIntentAllowsSignup("login")).toBe(false);
  });

  it("does not duplicate Google's verified identity with email OTP unless explicitly required", () => {
    expect(googleEmailOtpRequired({} as NodeJS.ProcessEnv)).toBe(false);
    expect(googleEmailOtpRequired({ GOOGLE_EMAIL_OTP_REQUIRED: "true" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("allows verified Gmail and Google Workspace identities", () => {
    expect(googleAutoLinkAllowed({ email: "user@gmail.com", emailVerified: true, hostedDomain: "" } as never)).toBe(true);
    expect(googleAutoLinkAllowed({ email: "user@company.example", emailVerified: true, hostedDomain: "company.example" } as never)).toBe(true);
  });

  it("requires additional ownership proof for external email domains", () => {
    expect(googleAutoLinkAllowed({ email: "user@example.com", emailVerified: true, hostedDomain: "" } as never)).toBe(false);
  });
});
