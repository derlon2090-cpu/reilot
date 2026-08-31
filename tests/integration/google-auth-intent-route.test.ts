import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateGoogle } = vi.hoisted(() => ({ authenticateGoogle: vi.fn() }));

vi.mock("../../src/server/google-auth.js", () => ({
  authenticateGoogle,
  clearGoogleNonceCookie: () => "renvix_google_nonce=; Path=/; HttpOnly; Max-Age=0",
  normalizeGoogleAuthIntent: (value: unknown) => value === "register" ? "register" : "login",
  readGoogleNonceDigest: () => "nonce-digest",
  verifyGoogleCredential: async () => ({
    ok: true,
    profile: { subject: "google-subject", email: "owner@gmail.com", emailVerified: true, name: "Owner", picture: "", hostedDomain: "" }
  })
}));

vi.mock("../../src/server/session.js", () => ({ sessionCookie: (token: string) => `session=${token}; Path=/; HttpOnly` }));
vi.mock("../../src/server/email-otp-v2.js", () => ({ challengeCookie: () => "", readTrustedBrowserCookie: () => "" }));
vi.mock("../../src/server/login-mfa.js", () => ({ mfaChallengeCookie: () => "" }));

import { POST } from "../../app/api/auth/google/route.js";

const originalAuthUrl = process.env.NEXT_PUBLIC_AUTH_URL;

function request(intent: "login" | "register") {
  return new Request("https://api.renvix.app/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://accounts.renvix.app" },
    body: JSON.stringify({ credential: "google-id-token", locale: "ar", intent })
  });
}

describe("Google authentication route intent", () => {
  beforeEach(() => {
    authenticateGoogle.mockReset();
    process.env.NEXT_PUBLIC_AUTH_URL = "https://accounts.renvix.app";
  });

  afterEach(() => {
    if (originalAuthUrl === undefined) delete process.env.NEXT_PUBLIC_AUTH_URL;
    else process.env.NEXT_PUBLIC_AUTH_URL = originalAuthUrl;
  });

  it("does not create an account during the login flow", async () => {
    authenticateGoogle.mockResolvedValue({ ok: false, status: 404, reason: "google_account_not_found" });
    const response = await POST(request("login"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, reason: "google_account_not_found", intent: "login" });
    expect(authenticateGoogle).toHaveBeenCalledWith(expect.objectContaining({ intent: "login" }));
  });

  it("creates and signs in a new account during the registration flow", async () => {
    authenticateGoogle.mockResolvedValue({
      ok: true,
      status: 201,
      user: { id: "user-1", email: "owner@gmail.com" },
      session: { token: "session-token" },
      created: true,
      linked: false,
      intent: "register"
    });
    const response = await POST(request("register"));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, created: true, linked: false, intent: "register" });
    expect(response.headers.get("set-cookie")).toContain("session=session-token");
    expect(authenticateGoogle).toHaveBeenCalledWith(expect.objectContaining({ intent: "register" }));
  });
});
