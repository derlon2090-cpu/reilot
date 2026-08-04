import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn(),
  verifyPassword: vi.fn(),
  createSession: vi.fn(),
  createMfaLoginChallenge: vi.fn(),
  createLoginEmailOtpChallenge: vi.fn(),
  isTrustedDevice: vi.fn()
}));

vi.mock("../../src/server/db.js", () => ({ query: mocks.query, transaction: mocks.transaction }));
vi.mock("../../src/server/password.js", () => ({ hashPassword: vi.fn(), verifyPassword: mocks.verifyPassword }));
vi.mock("../../src/server/session.js", () => ({ createSession: mocks.createSession }));
vi.mock("../../src/server/email-otp.js", () => ({
  createLoginEmailOtpChallenge: mocks.createLoginEmailOtpChallenge,
  isTrustedDevice: mocks.isTrustedDevice
}));
vi.mock("../../src/server/login-mfa.js", () => ({ createMfaLoginChallenge: mocks.createMfaLoginChallenge }));

import { loginAccount } from "../../src/server/auth-actions.js";

describe("credential login MFA precedence", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.transaction.mockReset();
    mocks.verifyPassword.mockReset().mockResolvedValue(true);
    mocks.createMfaLoginChallenge.mockReset().mockResolvedValue({
      challengeCookie: "signed-mfa",
      expiresAt: new Date(Date.now() + 300_000)
    });
    mocks.createLoginEmailOtpChallenge.mockReset();
    mocks.isTrustedDevice.mockReset();
    mocks.createSession.mockReset().mockResolvedValue({ token: "session-token" });
    mocks.transaction.mockImplementation(async (callback) => callback({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) }));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM login_attempts")) return { rows: [{ count: 0 }] };
      if (sql.includes("FROM users u") && sql.includes("JOIN accounts")) {
        return {
          rows: [{
            id: "user-1",
            tenantId: "tenant-1",
            name: "Owner",
            email: "owner@example.com",
            role: "owner",
            password: "hash",
            emailOtpEnabled: true,
            mfaEnabled: true,
            mfaSecret: "encrypted-secret",
            mustChangePassword: false
          }]
        };
      }
      return { rows: [], rowCount: 1 };
    });
  });

  it("requires the authenticator before trusted-device or email OTP checks", async () => {
    const result = await loginAccount({
      email: "owner@example.com",
      password: "CorrectPassword1!",
      ipAddress: "127.0.0.1",
      userAgent: "iPad",
      trustedDeviceToken: "trusted-browser-token"
    });

    expect(result).toMatchObject({ ok: true, status: 202, requiresMfa: true });
    expect(mocks.createMfaLoginChallenge).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ id: "user-1", mfaEnabled: true }),
      userAgent: "iPad"
    }));
    expect(mocks.isTrustedDevice).not.toHaveBeenCalled();
    expect(mocks.createLoginEmailOtpChallenge).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("treats an incomplete MFA flag without a secret as disabled", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM login_attempts")) return { rows: [{ count: 0 }] };
      if (sql.includes("FROM users u") && sql.includes("JOIN accounts")) {
        return {
          rows: [{
            id: "user-pending",
            tenantId: "tenant-1",
            name: "Owner",
            email: "pending@example.com",
            role: "owner",
            password: "hash",
            emailOtpEnabled: false,
            mfaEnabled: true,
            mfaSecret: null,
            mustChangePassword: false
          }]
        };
      }
      return { rows: [], rowCount: 1 };
    });

    const result = await loginAccount({
      email: "pending@example.com",
      password: "CorrectPassword1!",
      ipAddress: "127.0.0.1",
      userAgent: "iPad"
    });

    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(mocks.createMfaLoginChallenge).not.toHaveBeenCalled();
    expect(mocks.createSession).toHaveBeenCalled();
  });
});
