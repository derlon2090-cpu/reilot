import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/auth-actions.js", () => ({ loginAccount: vi.fn() }));

import { POST, classifyAuthFailure } from "../../app/api/auth/login/route.js";
import { loginAccount } from "../../src/server/auth-actions.js";

function loginRequest(password: string) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@example.com", password })
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => vi.mocked(loginAccount).mockReset());

  it("returns 401 without creating a cookie when credentials are invalid", async () => {
    vi.mocked(loginAccount).mockResolvedValue({ ok: false, status: 401, reason: "invalid_credentials" });
    const response = await POST(loginRequest("Wrong@999"));

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("sets an HttpOnly cookie only after credential verification succeeds", async () => {
    vi.mocked(loginAccount).mockResolvedValue({
      ok: true,
      status: 200,
      user: { id: "user-1", email: "owner@example.com" },
      session: { token: "raw-session-token" }
    });
    const response = await POST(loginRequest("Test@12345"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("renewpilot_session=");
    expect(JSON.stringify(body)).not.toContain("raw-session-token");
  });

  it("creates only the temporary OTP cookie when email verification is required", async () => {
    vi.mocked(loginAccount).mockResolvedValue({
      ok: true,
      status: 202,
      requiresEmailOtp: true,
      challenge: {
        challengeCookie: "signed-challenge",
        maskedEmail: "ow***@example.com",
        expiresAt: new Date("2026-07-27T12:05:00.000Z"),
        resendAt: new Date("2026-07-27T12:01:00.000Z")
      }
    });

    const response = await POST(loginRequest("Test@12345"));
    const body = await response.json();
    const cookie = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(202);
    expect(body.requiresEmailOtp).toBe(true);
    expect(cookie).toContain("renvix_email_otp_challenge=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toContain("renewpilot_session=");
    expect(JSON.stringify(body)).not.toContain("signed-challenge");
  });

  it("creates only the temporary MFA cookie when authenticator verification is required", async () => {
    process.env.MFA_CHALLENGE_KEY = "test-mfa-challenge-key-with-32-characters";
    vi.mocked(loginAccount).mockResolvedValue({
      ok: true,
      status: 202,
      requiresMfa: true,
      challenge: {
        challengeCookie: "signed-mfa-challenge",
        expiresAt: new Date("2026-08-01T12:05:00.000Z")
      }
    });

    const response = await POST(loginRequest("Test@12345"));
    const body = await response.json();
    const cookie = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(202);
    expect(body.requiresMfa).toBe(true);
    expect(cookie).toContain("renvix_mfa_login_challenge=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toContain("renewpilot_session=");
    expect(JSON.stringify(body)).not.toContain("signed-mfa-challenge");
  });

  it("returns 400 without a cookie for malformed JSON", async () => {
    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid-json"
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(loginAccount).not.toHaveBeenCalled();
  });

  it("reports OTP delivery outages without claiming the password is wrong", async () => {
    vi.mocked(loginAccount).mockResolvedValue({
      ok: false,
      status: 503,
      reason: "email_otp_unavailable"
    });
    const response = await POST(loginRequest("Correct@12345"));

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({ ok: false, reason: "email_otp_unavailable" });
  });

  it.each([
    ["42P01", "credential_lookup", 503, "auth_database_error"],
    ["", "session_creation", 503, "auth_session_error"],
    ["", "email_otp_fallback_challenge", 503, "auth_challenge_error"],
    ["AUTH_CONFIGURATION_ERROR", "email_otp_challenge", 503, "auth_configuration_error"]
  ])("classifies internal authentication failures without exposing server details", (code, stage, status, reason) => {
    expect(classifyAuthFailure({ code, authStage: stage })).toEqual({ code, stage, status, reason });
  });
});
