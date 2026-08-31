import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, auditMock, emailChallengeMock, hashPasswordMock, needsRehashMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  auditMock: vi.fn(),
  emailChallengeMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  needsRehashMock: vi.fn()
}));

vi.mock("../../src/server/admin-auth.js", () => ({
  auditAdmin: auditMock,
  requestIp: () => "127.0.0.1"
}));
vi.mock("../../src/server/db.js", () => ({
  databaseFailureReason: vi.fn(() => "admin_auth_service_unavailable"),
  query: queryMock,
  transaction: async (callback: (client: { query: ReturnType<typeof vi.fn> }) => unknown) => callback({ query: vi.fn() })
}));
vi.mock("../../src/server/password.js", () => ({ hashPassword: hashPasswordMock, needsRehash: needsRehashMock, verifyPassword: vi.fn(async () => true) }));
vi.mock("../../src/server/session.js", () => ({
  ADMIN_SESSION_COOKIE: "renvix_admin_session",
  destroySession: vi.fn(async () => undefined)
}));
vi.mock("../../src/server/email-otp-v2.js", () => ({
  createLoginEmailOtpChallenge: emailChallengeMock,
  adminChallengeCookie: (value: string) => `renvix_admin_email_otp_challenge=${value}; HttpOnly`
}));

import { classifyAdminAuthFailure, POST } from "../../app/api/admin/auth/login/route.js";

describe("admin login identifiers", () => {
  beforeEach(() => {
    queryMock.mockReset();
    auditMock.mockReset();
    emailChallengeMock.mockReset();
    hashPasswordMock.mockReset();
    needsRehashMock.mockReset().mockReturnValue(false);
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_OTP_PEPPER = "admin-login-email-otp-pepper-is-long-enough";
    emailChallengeMock.mockResolvedValue({
      challengeCookie: "signed-admin-challenge",
      maskedEmail: "ad•••@renvix.app",
      expiresAt: new Date(Date.now() + 300_000),
      resendAt: new Date(Date.now() + 60_000)
    });
  });

  it("accepts the permanent administrator username without weakening credential verification", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{
        userId: "user-1",
        name: "Renvix Admin",
        email: "admin@renvix.app",
        credentialId: "credential-1",
        passwordHash: "stored-hash",
        adminId: "admin-1",
        adminRole: "super_admin",
        status: "active",
        mfaEnabled: true,
        mfaSecret: "configured-totp-secret",
        expiresAt: null
      }] })
      .mockResolvedValue({ rows: [] });

    const response = await POST(new Request("http://localhost/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "renvix_root_7X9K", password: "A-very-strong-password", rememberMe: false })
    }));

    expect(response.status).toBe(202);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("renvix_admin_email_otp_challenge=");
    expect(response.headers.get("set-cookie")).not.toContain("Domain=");
    expect(queryMock.mock.calls[1][0]).toContain("lower(a.account_id)");
    expect(emailChallengeMock).toHaveBeenCalledWith(expect.objectContaining({ purpose: "admin_login" }));
    await expect(response.json()).resolves.toMatchObject({ ok: true, requiresEmailOtp: true });
  });

  it("never accepts a trusted browser or creates a direct admin session", () => {
    const source = readFileSync(resolve("app/api/admin/auth/login/route.js"), "utf8");
    const verificationSource = readFileSync(resolve("src/server/email-otp-v2.js"), "utf8");
    expect(source).not.toContain("readTrustedBrowserCookie");
    expect(source).not.toContain("resolveSecondFactor");
    expect(source).not.toContain("createSession");
    expect(source).toContain('purpose: "admin_login"');
    expect(verificationSource).toContain('const adminLogin = parsed.kind === "admin_login"');
    expect(verificationSource).toContain('? { rawToken: null, expiresAt: null }');
    expect(verificationSource).toContain('sessionCookieMaxAge: adminLogin ? null : undefined');
  });

  it("identifies email OTP provider failures instead of reporting a database outage", () => {
    expect(classifyAdminAuthFailure({
      code: "EMAIL_PROVIDER_ERROR",
      authStage: "email_otp_challenge",
      providerCode: "ETIMEDOUT"
    })).toEqual({
      reason: "email_otp_unavailable",
      status: 503,
      stage: "email_otp_challenge",
      code: "EMAIL_PROVIDER_ERROR"
    });
  });

  it("identifies second-factor challenge failures instead of returning the generic admin error", () => {
    expect(classifyAdminAuthFailure({
      authStage: "mfa_challenge"
    })).toEqual({
      reason: "auth_challenge_error",
      status: 503,
      stage: "mfa_challenge",
      code: ""
    });
  });

  it("identifies a failed email fallback challenge without misreporting a database outage", () => {
    expect(classifyAdminAuthFailure({
      authStage: "email_otp_fallback_challenge"
    })).toEqual({
      reason: "auth_challenge_error",
      status: 503,
      stage: "email_otp_fallback_challenge",
      code: ""
    });
  });
});
