import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ databaseHealth: vi.fn(), ensureAuthSchemaReady: vi.fn() }));

vi.mock("../../src/server/auth-backend-runtime.js", () => ({
  isRenderAuthRuntime: () => true
}));
vi.mock("../../src/server/db.js", () => ({
  databaseHealth: mocks.databaseHealth
}));
vi.mock("../../src/server/auth-schema-repair.js", () => ({
  ensureAuthSchemaReady: mocks.ensureAuthSchemaReady
}));

import { GET } from "../../app/api/auth/readiness/route.js";

describe("authentication backend readiness", () => {
  beforeEach(() => {
    mocks.databaseHealth.mockReset();
    mocks.ensureAuthSchemaReady.mockReset().mockResolvedValue(undefined);
  });

  it("announces readiness only after PostgreSQL responds", async () => {
    mocks.databaseHealth.mockResolvedValue({ ok: true, latencyMs: 37 });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "renvix-auth"
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("fails closed when the database health check is not ready", async () => {
    mocks.databaseHealth.mockResolvedValue({ ok: false });
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, reason: "database_unavailable" });
  });

});
