import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("password storage policy", () => {
  it("centralizes new password hashing in the Argon2id password service", () => {
    const service = read("src/server/password.js");
    expect(service).toContain("type: argon2.argon2id");
    expect(service).toContain("memoryCost: 19_456");
    expect(service).toContain("timeCost: 2");
    expect(service).toContain("parallelism: 1");
    expect(service).toContain("salt: crypto.randomBytes(16)");
    expect(service).not.toMatch(/createCipher|createDecipher|sha256\s*\(\s*password/i);
  });

  it("stores credential values only in password_hash and never returns it to clients", () => {
    for (const path of [
      "src/server/auth-actions.js",
      "src/server/password-reset.js",
      "src/server/admin-setup.js",
      "src/server/provisioning.js",
      "src/server/email-otp-v2.js",
      "app/api/admin/auth/login/route.js",
      "app/api/auth/change-password/route.js",
      "app/api/settings/security/change-password/route.js"
    ]) {
      const source = read(path);
      expect(source).not.toMatch(/accounts[^\n]*(?:SET|INSERT INTO)[^\n]*\bpassword\b(?!_hash)/i);
    }
    const auth = read("src/server/auth-actions.js");
    expect(auth).toContain("delete safeUser.passwordHash");
    expect(read("app/api/auth/register/route.js")).not.toContain("passwordHash");
  });

  it("never logs request bodies, plaintext passwords, or password hashes", () => {
    for (const path of [
      "app/api/auth/register/route.js",
      "app/api/auth/login/route.js",
      "app/api/admin/auth/login/route.js",
      "app/api/auth/reset-password/route.js",
      "app/api/auth/change-password/route.js"
    ]) {
      const source = read(path);
      expect(source).not.toMatch(/console\.(?:log|error|warn)\([^)]*(?:body\.password|passwordHash|password_hash)/s);
      expect(source).not.toMatch(/JSON\.stringify\(body\)/);
    }
  });

  it("ships a safe staged migration for legacy hashes", () => {
    const migration = read("drizzle/0071_argon2id_password_hash_stage1.sql");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS password_hash");
    expect(migration).toMatch(/password_hash\s*=\s*password/);
    expect(migration).toContain("accounts_password_hash_transition");
    expect(migration).toContain("NOT VALID");
    expect(migration).not.toMatch(/DROP COLUMN\s+(?:IF EXISTS\s+)?password/i);
  });

  it("finalizes only after validation and removes the legacy password column", () => {
    const migration = read("drizzle/0072_argon2id_password_hash_finalize.sql");
    expect(migration).toContain("provider_id = 'credential' AND password_hash IS NULL");
    expect(migration).toContain("VALIDATE CONSTRAINT accounts_credential_password_hash_required");
    expect(migration).toContain("DROP TRIGGER IF EXISTS accounts_password_hash_transition");
    expect(migration).toMatch(/DROP COLUMN IF EXISTS password/);
  });
});
