import { beforeEach, describe, expect, it } from "vitest";
import {
  AdminSetupError,
  consumeAdminSetupRateLimit,
  createFirstAdmin,
  resetAdminSetupRateLimitForTests,
  validateAdminSetupInput,
  validateAdminSetupPassword,
  verifyAdminSetupCsrf,
  verifySameOrigin,
  verifyAdminSetupToken
} from "../../src/server/admin-setup.js";

describe("first admin setup", () => {
  beforeEach(() => {
    process.env.ADMIN_SETUP_TOKEN = "setup-token-with-more-than-32-characters-123";
    resetAdminSetupRateLimitForTests();
  });

  it("requires a secret setup token and strong password", () => {
    expect(verifyAdminSetupToken("wrong-token")).toBe(false);
    expect(verifyAdminSetupToken(process.env.ADMIN_SETUP_TOKEN)).toBe(true);
    expect(validateAdminSetupPassword("short", "admin@example.com")).toBeTruthy();
    expect(validateAdminSetupPassword("AdminPassword123!", "admin@example.com")).toContain("ضعيفة");
    expect(validateAdminSetupInput({ name: "Admin", email: "admin@example.com", password: "Vx!2026KiteRiverStone", confirmPassword: "Vx!2026KiteRiverStone" }).ok).toBe(true);
  });

  it("requires a same-origin request and matching double-submit CSRF token", () => {
    const validRequest = new Request("https://renvix.test/api/admin/setup/create", {
      method: "POST",
      headers: {
        origin: "https://renvix.test",
        cookie: "renvix_admin_setup_csrf=csrf-token-123",
        "x-csrf-token": "csrf-token-123"
      }
    });
    expect(verifySameOrigin(validRequest)).toBe(true);
    expect(verifyAdminSetupCsrf(validRequest)).toBe(true);

    const crossOriginRequest = new Request("https://renvix.test/api/admin/setup/create", {
      method: "POST",
      headers: {
        origin: "https://attacker.test",
        cookie: "renvix_admin_setup_csrf=csrf-token-123",
        "x-csrf-token": "different-token"
      }
    });
    expect(verifySameOrigin(crossOriginRequest)).toBe(false);
    expect(verifyAdminSetupCsrf(crossOriginRequest)).toBe(false);
  });

  it("creates one administrator in a transaction without storing a plaintext password", async () => {
    const calls: string[] = [];
    const client = {
      query: async (sql: string) => {
        calls.push(sql);
        if (sql.includes("count(*)")) return { rows: [{ count: 0 }] };
        if (sql.includes("SELECT id FROM users")) return { rows: [] };
        if (sql.includes("INSERT INTO users")) return { rows: [{ id: "user-1", name: "Admin", email: "admin@example.com" }] };
        if (sql.includes("INSERT INTO admin_users")) return { rows: [{ id: "admin-1", role: "super_admin" }] };
        return { rows: [] };
      }
    };
    const result = await createFirstAdmin({ name: "Admin", email: "admin@example.com", password: "Vx!2026KiteRiverStone", confirmPassword: "Vx!2026KiteRiverStone" }, {
      transactionFn: async (callback) => callback(client),
      hashPasswordFn: async () => "$2b$12$hashed-password",
      createSessionFn: async () => ({ token: "session-token" })
    });
    expect(result.admin.role).toBe("super_admin");
    expect(result.session.token).toBe("session-token");
    expect(calls.some((sql) => sql.includes("pg_advisory_xact_lock"))).toBe(true);
    expect(calls.some((sql) => sql.includes("INSERT INTO accounts"))).toBe(true);
    expect(calls.join(" ")).not.toContain("Vx!2026KiteRiverStone");
  });

  it("blocks setup when an administrator already exists and rate-limits retries", async () => {
    await expect(createFirstAdmin({ name: "Admin", email: "admin@example.com", password: "Vx!2026KiteRiverStone", confirmPassword: "Vx!2026KiteRiverStone" }, {
      transactionFn: async (callback) => callback({ query: async (sql: string) => sql.includes("count(*)") ? { rows: [{ count: 1 }] } : { rows: [] } })
    })).rejects.toMatchObject<AdminSetupError>({ code: "already_configured" });
    for (let index = 0; index < 8; index += 1) expect(consumeAdminSetupRateLimit("same-ip").ok).toBe(true);
    expect(consumeAdminSetupRateLimit("same-ip").ok).toBe(false);
  });

  it("allows only one winner when two first-admin requests run at the same time", async () => {
    let adminCreated = false;
    let lock = Promise.resolve();
    const transactionFn = async (callback) => {
      const previous = lock;
      let release;
      lock = new Promise((resolve) => { release = resolve; });
      await previous;
      const client = {
        query: async (sql: string) => {
          if (sql.includes("count(*)")) return { rows: [{ count: adminCreated ? 1 : 0 }] };
          if (sql.includes("SELECT id FROM users")) return { rows: [] };
          if (sql.includes("INSERT INTO users")) return { rows: [{ id: "user-1", name: "Admin", email: "admin@example.com" }] };
          if (sql.includes("INSERT INTO admin_users")) { adminCreated = true; return { rows: [{ id: "admin-1", role: "super_admin" }] }; }
          return { rows: [] };
        }
      };
      try { return await callback(client); } finally { release(); }
    };
    const input = { name: "Admin", email: "admin@example.com", password: "Vx!2026KiteRiverStone", confirmPassword: "Vx!2026KiteRiverStone" };
    const dependencies = { transactionFn, hashPasswordFn: async () => "$2b$12$hash", createSessionFn: async () => ({ token: "session" }) };
    const results = await Promise.allSettled([
      createFirstAdmin(input, dependencies),
      createFirstAdmin(input, dependencies)
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
    expect(rejected?.reason).toMatchObject({ code: "already_configured" });
  });
});
