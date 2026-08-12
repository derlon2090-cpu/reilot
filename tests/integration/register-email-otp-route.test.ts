import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/auth-actions.js", () => ({ registerAccount: vi.fn() }));
import { POST } from "../../app/api/auth/register/route.js";
import { registerAccount } from "../../src/server/auth-actions.js";

function request() {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "New Owner", companyName: "Store", email: "new@example.com", password: "StrongPass!234", turnstileToken: "1x00000000000000000000AA" })
  });
}

describe("POST /api/auth/register pending email verification", () => {
  beforeEach(() => {
    vi.mocked(registerAccount).mockReset();
    process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
    process.env.AUTH_URL = "https://accounts.renvix.app";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, hostname: "accounts.renvix.app", action: "register" }), { headers: { "Content-Type": "application/json" } })));
  });
  afterEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
    vi.unstubAllGlobals();
  });

  it("sets only a temporary signup challenge and creates no session before OTP", async () => {
    vi.mocked(registerAccount).mockResolvedValue({
      ok: true, status: 202, requiresEmailOtp: true,
      challenge: { challengeCookie: "signed-signup", maskedEmail: "ne•••@example.com", expiresAt: new Date(), resendAt: new Date() }
    });
    const response = await POST(request());
    const body = await response.json();
    const cookie = response.headers.get("set-cookie") || "";
    expect(response.status).toBe(202);
    expect(body).toMatchObject({ ok: true, requiresEmailOtp: true });
    expect(cookie).toContain("renvix_email_otp_challenge=");
    expect(cookie).not.toContain("renewpilot_session=");
    expect(JSON.stringify(body)).not.toContain("signed-signup");
  });

  it("returns a validation error instead of a server error for malformed JSON", async () => {
    const response = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid-json"
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, reason: "invalid_request" });
    expect(registerAccount).not.toHaveBeenCalled();
  });
});
