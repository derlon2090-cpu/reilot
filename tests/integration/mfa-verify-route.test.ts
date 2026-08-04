import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMfaLogin = vi.hoisted(() => vi.fn());
vi.mock("../../src/server/login-mfa.js", () => ({
  verifyMfaLogin,
  readMfaChallengeCookie: () => "signed-mfa",
  clearMfaChallengeCookie: () => "renvix_mfa_login_challenge=; Max-Age=0; HttpOnly"
}));
vi.mock("../../src/server/session.js", () => ({ sessionCookie: (token: string) => `renewpilot_session=${token}; HttpOnly` }));
vi.mock("../../src/server/email-otp-v2.js", () => ({
  readTrustedBrowserCookie: () => "",
  trustedBrowserCookie: (token: string) => `__Host-rvx_trusted_browser=${token}; Max-Age=172800; HttpOnly; Secure; SameSite=Lax; Path=/`
}));
import { POST } from "../../app/api/auth/mfa/verify/route.js";

describe("POST /api/auth/mfa/verify", () => {
  beforeEach(() => verifyMfaLogin.mockReset());

  it("creates the complete session and trusted browser directly after valid TOTP", async () => {
    verifyMfaLogin.mockResolvedValue({
      ok: true, session: { token: "session-token" }, trustedToken: "browser-token",
      trustedUntil: new Date(Date.now() + 172_800_000), redirectUrl: "/dashboard", user: { id: "user-1" }
    });
    const response = await POST(new Request("http://localhost/api/auth/mfa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "123456" }) }));
    const body = await response.json();
    const cookies = response.headers.get("set-cookie") || "";
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, redirectUrl: "/dashboard" });
    expect(cookies).toContain("renewpilot_session=session-token");
    expect(cookies).toContain("__Host-rvx_trusted_browser=browser-token");
    expect(cookies).not.toContain("renvix_email_otp_challenge");
  });

  it("creates no session when the authenticator code is invalid", async () => {
    verifyMfaLogin.mockResolvedValue({ ok: false, status: 401, reason: "invalid_code", attemptsRemaining: 4 });
    const response = await POST(new Request("http://localhost/api/auth/mfa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "000000" }) }));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
