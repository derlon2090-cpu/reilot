import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function credentialUser(overrides = {}) {
  return {
    id: "user-1",
    tenantId: "tenant-1",
    name: "New owner",
    email: "new-owner@example.test",
    role: "owner",
    password: "hash",
    emailOtpEnabled: false,
    mfaEnabled: false,
    mfaSecret: null,
    mustChangePassword: false,
    ...overrides
  };
}

describe("credential login availability", () => {
  beforeEach(() => {
    delete process.env.EMAIL_OTP_ENFORCE_ALL;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_OTP_PEPPER;
    mocks.query.mockReset();
    mocks.transaction.mockReset();
    mocks.verifyPassword.mockReset().mockResolvedValue(true);
    mocks.createSession.mockReset().mockResolvedValue({ token: "session-token" });
    mocks.createMfaLoginChallenge.mockReset();
    mocks.createLoginEmailOtpChallenge.mockReset();
    mocks.isTrustedDevice.mockReset();
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM login_attempts")) return { rows: [{ count: 0 }] };
      if (sql.includes("FROM users u") && sql.includes("JOIN accounts")) return { rows: [credentialUser()] };
      return { rows: [], rowCount: 1 };
    });
    mocks.transaction.mockImplementation(async (callback) => callback({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) }));
  });

  afterEach(() => {
    delete process.env.EMAIL_OTP_ENFORCE_ALL;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_OTP_PEPPER;
  });

  it("creates a normal session for a new user without OTP provider configuration", async () => {
    const result = await loginAccount({
      email: "new-owner@example.test",
      password: "CorrectPassword1!",
      ipAddress: "127.0.0.1",
      userAgent: "local-test"
    });

    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(mocks.createSession).toHaveBeenCalledOnce();
    expect(mocks.createLoginEmailOtpChallenge).not.toHaveBeenCalled();
    expect(mocks.isTrustedDevice).not.toHaveBeenCalled();
  });

  it("returns a clear availability error only when email OTP is explicitly enabled", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM login_attempts")) return { rows: [{ count: 0 }] };
      if (sql.includes("FROM users u") && sql.includes("JOIN accounts")) {
        return { rows: [credentialUser({ emailOtpEnabled: true })] };
      }
      return { rows: [], rowCount: 1 };
    });
    mocks.isTrustedDevice.mockResolvedValue(false);

    const result = await loginAccount({
      email: "new-owner@example.test",
      password: "CorrectPassword1!",
      ipAddress: "127.0.0.1",
      userAgent: "local-test"
    });

    expect(result).toEqual({ ok: false, status: 503, reason: "email_otp_unavailable" });
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("does not leak credentials or incomplete MFA values in a successful response", async () => {
    const result = await loginAccount({
      email: "new-owner@example.test",
      password: "CorrectPassword1!",
      ipAddress: "127.0.0.1",
      userAgent: "local-test"
    });

    expect(result.user).not.toHaveProperty("password");
    expect(result.user).not.toHaveProperty("emailOtpEnabled");
    expect(result.user).not.toHaveProperty("mfaEnabled");
    expect(result.user).not.toHaveProperty("mfaSecret");
  });

  it("registers new users with email OTP disabled until they explicitly enable it", () => {
    const source = fs.readFileSync(path.resolve("src/server/auth-actions.js"), "utf8");
    expect(source).toContain("VALUES ($1, $2, $3, 'owner', $4, now(), false)");
    expect(source).not.toContain("VALUES ($1, $2, $3, 'owner', $4, now(), true)");
  });
});
