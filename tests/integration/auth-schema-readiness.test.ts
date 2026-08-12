import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/db.js", () => ({ query: vi.fn() }));
import { query } from "../../src/server/db.js";
import { authSchemaHealth, REQUIRED_AUTH_MIGRATION, REQUIRED_PASSWORD_MIGRATION } from "../../src/server/auth-schema-readiness.js";

describe("authentication database schema readiness", () => {
  beforeEach(() => vi.mocked(query).mockReset());

  it("accepts only the complete repaired authentication schema", async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{
      migration_applied: true,
      password_migration_applied: true,
      password_hash_column_ready: true,
      legacy_password_column_removed: true,
      pending_registration_table: true,
      purpose_constraint_ready: true,
      platform_admin_challenges_ready: true,
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
    await expect(authSchemaHealth()).resolves.toMatchObject({
      ok: true,
      migration: REQUIRED_AUTH_MIGRATION,
      passwordMigration: REQUIRED_PASSWORD_MIGRATION,
      passwordHashColumnReady: true,
      legacyPasswordColumnRemoved: true
    });
  });

  it("reports a missing pending-registration table or column", async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{
      migration_applied: false,
      password_migration_applied: false,
      password_hash_column_ready: false,
      legacy_password_column_removed: false,
      pending_registration_table: false,
      purpose_constraint_ready: false,
      platform_admin_challenges_ready: false,
      available_columns: ["users.email_verified_at"]
    }] } as never);
    const result = await authSchemaHealth();
    expect(result.ok).toBe(false);
    expect(result.pendingRegistrationTable).toBe(false);
    expect(result.purposeConstraintReady).toBe(false);
    expect(result.platformAdminChallengesReady).toBe(false);
    expect(result.missingColumns).toContain("auth_mfa_login_challenges.target_path");
  });
});
