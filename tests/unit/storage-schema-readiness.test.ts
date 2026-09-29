import { describe, expect, it, vi } from "vitest";
import { validateMigrationPlan } from "../../scripts/lib/migration-runner.mjs";
import { storageMigrationLedgerReady } from "../../src/server/storage-schema.js";

const migrations = [{ name: "0094_storage.sql", sql: "SELECT 1" }, { name: "0095_storage.sql", sql: "SELECT 2" }];
const plan = validateMigrationPlan(migrations);

describe("Storage Center schema readiness", () => {
  it("accepts a complete verified ledger without taking the migration lock", async () => {
    const query = vi.fn(async (_sql: string) => ({ rows: plan.map(({ name, checksum }) => ({ name, checksum })) }));
    await expect(storageMigrationLedgerReady({ query }, migrations)).resolves.toBe(true);
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0]).not.toContain("pg_try_advisory_lock");
  });

  it("runs the migration gate when a new migration or ledger is missing", async () => {
    await expect(storageMigrationLedgerReady({ query: async () => ({ rows: [plan[0]] }) }, migrations)).resolves.toBe(false);
    await expect(storageMigrationLedgerReady({ query: async () => { throw Object.assign(new Error("missing"), { code: "42P01" }); } }, migrations)).resolves.toBe(false);
  });

  it("rejects a changed applied migration checksum", async () => {
    const query = async () => ({ rows: [{ name: plan[0].name, checksum: "changed" }, plan[1]] });
    await expect(storageMigrationLedgerReady({ query }, migrations)).rejects.toMatchObject({ code: "MIGRATION_CHECKSUM_MISMATCH" });
  });
});
