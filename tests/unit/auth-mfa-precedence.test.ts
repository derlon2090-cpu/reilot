import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), transaction: vi.fn(), hashPassword: vi.fn(), needsRehash: vi.fn(), verifyPassword: vi.fn(), createSession: vi.fn(),
  createMfaLoginChallenge: vi.fn(), createLoginEmailOtpChallenge: vi.fn(), resolveSecondFactor: vi.fn()
}));

vi.mock("../../src/server/db.js", () => ({ query: mocks.query, transaction: mocks.transaction }));
vi.mock("../../src/server/password.js", () => ({ hashPassword: mocks.hashPassword, needsRehash: mocks.needsRehash, verifyPassword: mocks.verifyPassword }));
vi.mock("../../src/server/session.js", () => ({ createSession: mocks.createSession }));
vi.mock("../../src/server/email-otp-v2.js", () => ({
  createLoginEmailOtpChallenge: mocks.createLoginEmailOtpChallenge,
  createRegistrationEmailOtpChallenge: vi.fn()
}));
vi.mock("../../src/server/login-mfa.js", () => ({ createMfaLoginChallenge: mocks.createMfaLoginChallenge }));
vi.mock("../../src/server/second-factor-router.js", () => ({ resolveSecondFactor: mocks.resolveSecondFactor }));

import { loginAccount } from "../../src/server/auth-actions.js";

const user = { id: "user-1", tenantId: "tenant-1", name: "Owner", email: "owner@example.com", role: "owner", credentialId: "credential-1", passwordHash: "hash", mfaEnabled: true, mfaSecret: "encrypted-secret", mustChangePassword: false };

describe("credential login second-factor precedence", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_OTP_PEPPER = "test-email-otp-pepper-that-is-long-enough";
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.needsRehash.mockReturnValue(false);
    mocks.createMfaLoginChallenge.mockResolvedValue({ challengeCookie: "signed-mfa", expiresAt: new Date(Date.now() + 300_000) });
    mocks.createLoginEmailOtpChallenge.mockResolvedValue({ challengeCookie: "signed-email", maskedEmail: "ow•••@example.com" });
    mocks.createSession.mockResolvedValue({ token: "session-token" });
    mocks.transaction.mockImplementation(async (callback) => callback({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) }));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT count(*)") && sql.includes("login_attempts")) return { rows: [{ count: 0 }] };
      if (sql.includes("INSERT INTO login_attempts")) return { rows: [{ id: "attempt-1" }], rowCount: 1 };
      if (sql.includes("FROM users u") && sql.includes("JOIN accounts")) return { rows: [user] };
      return { rows: [], rowCount: 1 };
    });
  });

  it("creates only a TOTP challenge and never creates or sends email OTP", async () => {
    mocks.resolveSecondFactor.mockResolvedValue({ method: "totp", reason: "missing_cookie", requiresChallenge: true });
    const result = await loginAccount({ email: user.email, password: "CorrectPassword1!", ipAddress: "127.0.0.1", userAgent: "iPad" });
    expect(result).toMatchObject({ ok: true, status: 202, requiresMfa: true });
    expect(mocks.createMfaLoginChallenge).toHaveBeenCalledWith(expect.objectContaining({ loginAttemptId: "attempt-1" }));
    expect(mocks.createLoginEmailOtpChallenge).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("creates only an email challenge for a user without active TOTP", async () => {
    mocks.resolveSecondFactor.mockResolvedValue({ method: "email_otp", reason: "missing_cookie", requiresChallenge: true });
    const result = await loginAccount({ email: user.email, password: "CorrectPassword1!", ipAddress: "127.0.0.1", userAgent: "Safari" });
    expect(result).toMatchObject({ ok: true, status: 202, requiresEmailOtp: true });
    expect(mocks.createLoginEmailOtpChallenge).toHaveBeenCalledWith(expect.objectContaining({ loginAttemptId: "attempt-1", purpose: "login" }));
    expect(mocks.createMfaLoginChallenge).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("requires email OTP instead of bypassing verification when TOTP challenge creation fails", async () => {
    mocks.resolveSecondFactor.mockResolvedValue({ method: "totp", reason: "missing_cookie", requiresChallenge: true });
    mocks.createMfaLoginChallenge.mockRejectedValue(Object.assign(new Error("challenge store unavailable"), { code: "42703" }));
    const result = await loginAccount({ email: user.email, password: "CorrectPassword1!", ipAddress: "127.0.0.1", userAgent: "iPad" });
    expect(result).toMatchObject({ ok: true, status: 202, requiresEmailOtp: true, fallbackFrom: "totp" });
    expect(mocks.createLoginEmailOtpChallenge).toHaveBeenCalledWith(expect.objectContaining({ purpose: "login", loginAttemptId: "attempt-1" }));
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("creates a session directly only when the router accepts the trusted browser", async () => {
    mocks.resolveSecondFactor.mockResolvedValue({ method: "trusted_browser", reason: "valid", requiresChallenge: false });
    const result = await loginAccount({ email: user.email, password: "CorrectPassword1!", ipAddress: "127.0.0.1", userAgent: "Safari", trustedDeviceToken: "token" });
    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(mocks.createSession).toHaveBeenCalledOnce();
    expect(mocks.createMfaLoginChallenge).not.toHaveBeenCalled();
    expect(mocks.createLoginEmailOtpChallenge).not.toHaveBeenCalled();
  });
});
