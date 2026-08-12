import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn(),
  hashPassword: vi.fn(),
  sendPasswordChangedEmail: vi.fn(),
  sendPasswordResetCodeEmail: vi.fn()
}));

vi.mock("../../src/server/db.js", () => ({ query: mocks.query, transaction: mocks.transaction }));
vi.mock("../../src/server/password.js", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("../../src/server/email/resend.service.js", () => ({
  sendPasswordChangedEmail: mocks.sendPasswordChangedEmail,
  sendPasswordResetCodeEmail: mocks.sendPasswordResetCodeEmail
}));

import { resetPassword } from "../../src/server/password-reset.js";

describe("password reset storage and invalidation", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.hashPassword.mockResolvedValue("$argon2id$v=19$m=19456,t=2,p=1$reset-hash");
    mocks.sendPasswordChangedEmail.mockResolvedValue({ id: "email-1" });
    mocks.query.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it("stores only the Argon2id hash and invalidates reset tokens and sessions", async () => {
    const code = "123456";
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM password_reset_codes") && sql.includes("FOR UPDATE")) {
          return {
            rows: [{
              id: "reset-1",
              userId: "user-1",
              codeHash: crypto.createHash("sha256").update(code).digest("hex"),
              attempts: 0,
              expiresAt: new Date(Date.now() + 60_000)
            }],
            rowCount: 1
          };
        }
        if (sql.includes("FROM users")) {
          return { rows: [{ id: "user-1", tenantId: "tenant-1", email: "owner@example.test" }], rowCount: 1 };
        }
        if (sql.includes("UPDATE accounts SET password_hash")) return { rows: [{ user_id: "user-1" }], rowCount: 1 };
        if (sql.includes("to_regclass")) return { rows: [{ trusted_devices: null, otp_challenges: null }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      })
    };
    mocks.transaction.mockImplementation(async (callback) => callback(client));

    await expect(resetPassword({ email: "owner@example.test", code, password: "StrongPassword!123" }))
      .resolves.toEqual({ ok: true, status: 200 });

    expect(mocks.hashPassword).toHaveBeenCalledWith("StrongPassword!123");
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE accounts SET password_hash = $1"),
      ["$argon2id$v=19$m=19456,t=2,p=1$reset-hash", "user-1"]
    );
    expect(client.query).toHaveBeenCalledWith(
      "UPDATE password_reset_codes SET used_at = now() WHERE user_id = $1 AND used_at IS NULL",
      ["user-1"]
    );
    expect(client.query).toHaveBeenCalledWith("DELETE FROM sessions WHERE user_id = $1", ["user-1"]);
    expect(client.query.mock.calls.some(([sql]) => /UPDATE accounts SET password\s*=/.test(sql))).toBe(false);
  });
});
