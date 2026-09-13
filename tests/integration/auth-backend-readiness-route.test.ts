import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ databaseHealth: vi.fn() }));

vi.mock("../../src/server/auth-backend-runtime.js", () => ({
  isRenderAuthRuntime: () => true
}));
vi.mock("../../src/server/db.js", () => ({
  databaseHealth: mocks.databaseHealth
}));

import { GET } from "../../app/api/auth/readiness/route.js";

describe("authentication backend readiness", () => {
  beforeEach(() => mocks.databaseHealth.mockReset());

  it("announces readiness only after PostgreSQL responds", async () => {
    mocks.databaseHealth.mockResolvedValue({ ok: true, latencyMs: 37 });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "renvix-auth",
      database: "connected",
      latencyMs: 37
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

});
