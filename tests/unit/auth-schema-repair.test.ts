import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ connect: vi.fn(), query: vi.fn(), release: vi.fn() }));
vi.mock("../../src/server/db.js", () => ({
  getPool: () => ({ connect: mocks.connect })
}));

describe("auth schema repair", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.connect.mockReset();
    mocks.query.mockReset();
    mocks.release.mockReset();
    mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
  });

  it("applies the two additive auth migrations under one advisory lock", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("information_schema.columns")) return { rows: [{ present: 0 }] };
      return { rows: [] };
    });
    const { ensureAuthSchemaReady } = await import("../../src/server/auth-schema-repair.js");

    await expect(ensureAuthSchemaReady()).resolves.toEqual({ repaired: true });

    expect(mocks.query).toHaveBeenCalledWith("BEGIN");
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("ADD COLUMN IF NOT EXISTS account_phone_e164"));
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO schema_migrations"),
      ["0092_registration_phone_and_commerce_platform.sql", "0097_user_account_lifecycle.sql"]
    );
    expect(mocks.query).toHaveBeenCalledWith("COMMIT");
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});

