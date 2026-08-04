import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), verifyPassword: vi.fn(), createSession: vi.fn(), resolveSecondFactor: vi.fn(), createLoginEmailOtpChallenge: vi.fn() }));
vi.mock("../../src/server/db.js", () => ({ query: mocks.query, transaction: mocks.transaction }));
vi.mock("../../src/server/password.js", () => ({ hashPassword: vi.fn(), verifyPassword: mocks.verifyPassword }));
vi.mock("../../src/server/session.js", () => ({ createSession: mocks.createSession }));
vi.mock("../../src/server/login-mfa.js", () => ({ createMfaLoginChallenge: vi.fn() }));
vi.mock("../../src/server/email-otp-v2.js", () => ({ createLoginEmailOtpChallenge: mocks.createLoginEmailOtpChallenge, createRegistrationEmailOtpChallenge: vi.fn() }));
vi.mock("../../src/server/second-factor-router.js", () => ({ resolveSecondFactor: mocks.resolveSecondFactor }));

import { loginAccount } from "../../src/server/auth-actions.js";

describe("credential login availability", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY; delete process.env.EMAIL_OTP_PEPPER;
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.verifyPassword.mockResolvedValue(true); mocks.createSession.mockResolvedValue({ token: "session" });
    mocks.resolveSecondFactor.mockResolvedValue({ method: "none", reason: "policy_disabled", requiresChallenge: false });
    mocks.transaction.mockImplementation(async (callback) => callback({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) }));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT count(*)") && sql.includes("login_attempts")) return { rows: [{ count: 0 }] };
      if (sql.includes("INSERT INTO login_attempts")) return { rows: [{ id: "attempt-1" }] };
      if (sql.includes("FROM users u") && sql.includes("JOIN accounts")) return { rows: [{ id: "user-1", tenantId: "tenant-1", email: "owner@example.test", name: "Owner", role: "owner", password: "hash", mfaEnabled: false, mfaSecret: null }] };
      return { rows: [], rowCount: 1 };
    });
  });

  it("keeps TOTP login independent from Resend availability", async () => {
    mocks.resolveSecondFactor.mockResolvedValue({ method: "totp", reason: "missing_cookie", requiresChallenge: true });
    const { createMfaLoginChallenge } = await import("../../src/server/login-mfa.js");
    vi.mocked(createMfaLoginChallenge).mockResolvedValue({ challengeCookie: "mfa", expiresAt: new Date() });
    const result = await loginAccount({ email: "owner@example.test", password: "CorrectPassword1!", ipAddress: "127.0.0.1", userAgent: "test" });
    expect(result).toMatchObject({ ok: true, requiresMfa: true });
    expect(mocks.createLoginEmailOtpChallenge).not.toHaveBeenCalled();
  });

  it("fails closed when the selected email factor cannot be delivered", async () => {
    mocks.resolveSecondFactor.mockResolvedValue({ method: "email_otp", reason: "missing_cookie", requiresChallenge: true });
    const result = await loginAccount({ email: "owner@example.test", password: "CorrectPassword1!", ipAddress: "127.0.0.1", userAgent: "test" });
    expect(result).toEqual({ ok: false, status: 503, reason: "email_otp_unavailable" });
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("creates no account or session in the registration action before Email OTP", () => {
    const source = fs.readFileSync(path.resolve("src/server/auth-actions.js"), "utf8");
    expect(source).toContain("createRegistrationEmailOtpChallenge");
    expect(source).not.toContain("INSERT INTO tenants");
    expect(source).not.toContain("INSERT INTO users");
  });
});
