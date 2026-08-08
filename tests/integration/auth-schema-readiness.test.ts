import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/db.js", () => ({ query: vi.fn() }));
import { query } from "../../src/server/db.js";
import { authSchemaHealth, REQUIRED_AUTH_MIGRATION } from "../../src/server/auth-schema-readiness.js";

describe("authentication database schema readiness", () => {
  beforeEach(() => vi.mocked(query).mockReset());

  it("accepts only the complete 0060 authentication schema", async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{
      migration_applied: true,
      pending_registration_table: true,
      available_columns: [
        "auth_email_otp_challenges.login_attempt_id",
        "auth_email_otp_challenges.updated_at",
        "auth_mfa_login_challenges.login_attempt_id",
        "auth_mfa_login_challenges.target_path",
        "auth_mfa_login_challenges.updated_at",
        "auth_trusted_devices.revoke_reason",
        "auth_trusted_devices.updated_at",
        "users.email_verified_at",
        "users.mfa_last_verified_step"
      ]
    }] } as never);
    await expect(authSchemaHealth()).resolves.toMatchObject({ ok: true, migration: REQUIRED_AUTH_MIGRATION });
  });

  it("reports a missing pending-registration table or column", async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{
      migration_applied: false,
      pending_registration_table: false,
      available_columns: ["users.email_verified_at"]
    }] } as never);
    const result = await authSchemaHealth();
    expect(result.ok).toBe(false);
    expect(result.pendingRegistrationTable).toBe(false);
    expect(result.missingColumns).toContain("auth_mfa_login_challenges.target_path");
  });
});
