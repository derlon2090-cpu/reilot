import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runMigrationPlan } from "../../scripts/lib/migration-runner.mjs";

class SharedDatabase {
  lockOwner = "";
  ledger = new Map<string, string>();
  slowRelease: null | (() => void) = null;
}

class MigrationClient {
  pending: null | { name?: string; checksum?: string } = null;
  rollbacks = 0;
  constructor(public id: string, public shared: SharedDatabase) {}

  async query(sql: string, values: unknown[] = []) {
    if (sql.includes("pg_try_advisory_lock")) {
      if (!this.shared.lockOwner) this.shared.lockOwner = this.id;
      return { rows: [{ locked: this.shared.lockOwner === this.id }] };
    }
    if (sql.includes("pg_advisory_unlock")) {
      const unlocked = this.shared.lockOwner === this.id;
      if (unlocked) this.shared.lockOwner = "";
      return { rows: [{ unlocked }] };
    }
    if (sql === "BEGIN") { this.pending = {}; return { rows: [] }; }
    if (sql === "COMMIT") {
      if (this.pending?.name && this.pending.checksum) this.shared.ledger.set(this.pending.name, this.pending.checksum);
      this.pending = null;
      return { rows: [] };
    }
    if (sql === "ROLLBACK") { this.pending = null; this.rollbacks += 1; return { rows: [] }; }
    if (sql.includes("SELECT name,checksum FROM schema_migrations")) {
      return { rows: [...this.shared.ledger].map(([name, checksum]) => ({ name, checksum })) };
    }
    if (sql.includes("UPDATE schema_migrations SET checksum")) {
      this.shared.ledger.set(String(values[0]), String(values[1]));
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO schema_migrations")) {
      this.pending = { name: String(values[0]), checksum: String(values[1]) };
      return { rows: [] };
    }
    if (sql === "SLOW") await new Promise<void>((resolve) => { this.shared.slowRelease = resolve; });
    if (sql === "FAIL") throw Object.assign(new Error("migration failed"), { code: "TEST_FAILURE" });
    return { rows: [] };
  }
}

describe("production migration safety", () => {
  it("keeps database mutation out of frontend builds and web container startup", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
    const vercel = JSON.parse(readFileSync(resolve("vercel.json"), "utf8"));
    const docker = readFileSync(resolve("Dockerfile"), "utf8");
    expect(pkg.scripts.prebuild).toBe("node build.mjs");
    expect(pkg.scripts["db:migrate:production"]).toBe("node scripts/migrate-production.mjs");
    expect(vercel.buildCommand).toBe("npm run build");
    expect(docker).not.toContain("migrate.mjs &&");
  });

  it("serializes concurrent deploys so the second runner observes the committed ledger", async () => {
    const shared = new SharedDatabase();
    const first = new MigrationClient("first", shared);
    const second = new MigrationClient("second", shared);
    const migration = [{ name: "0001_slow.sql", sql: "SLOW" }];
    const firstRun = runMigrationPlan(first, { migrations: migration, pollIntervalMs: 25, logger: { log: vi.fn(), error: vi.fn() } });
    while (!shared.slowRelease) await new Promise((resolve) => setTimeout(resolve, 1));
    const secondRun = runMigrationPlan(second, { migrations: migration, pollIntervalMs: 25, logger: { log: vi.fn(), error: vi.fn() } });
    shared.slowRelease();
    const [a, b] = await Promise.all([firstRun, secondRun]);
    expect(a.applied).toBe(1);
    expect(b.skipped).toBe(1);
    expect(shared.ledger.size).toBe(1);
    expect(shared.lockOwner).toBe("");
  });

  it("rolls back and releases the lock on failure, then recovers on a later run", async () => {
    const shared = new SharedDatabase();
    const failedClient = new MigrationClient("failed", shared);
    await expect(runMigrationPlan(failedClient, {
      migrations: [{ name: "0001_retry.sql", sql: "FAIL" }],
      logger: { log: vi.fn(), error: vi.fn() }
    })).rejects.toThrow("migration failed");
    expect(failedClient.rollbacks).toBe(1);
    expect(shared.lockOwner).toBe("");
    expect(shared.ledger.size).toBe(0);

    const recovery = await runMigrationPlan(new MigrationClient("recovery", shared), {
      migrations: [{ name: "0001_retry.sql", sql: "SELECT 1" }],
      logger: { log: vi.fn(), error: vi.fn() }
    });
    expect(recovery).toMatchObject({ applied: 1, verified: true });
    expect(shared.ledger.size).toBe(1);
  });

  it("rejects a changed checksum for an already-applied migration", async () => {
    const shared = new SharedDatabase();
    await runMigrationPlan(new MigrationClient("first", shared), {
      migrations: [{ name: "0001_fixed.sql", sql: "SELECT 1" }], logger: { log: vi.fn(), error: vi.fn() }
    });
    await expect(runMigrationPlan(new MigrationClient("second", shared), {
      migrations: [{ name: "0001_fixed.sql", sql: "SELECT 2" }], logger: { log: vi.fn(), error: vi.fn() }
    })).rejects.toMatchObject({ code: "MIGRATION_CHECKSUM_MISMATCH" });
    expect(shared.lockOwner).toBe("");
  });
});
