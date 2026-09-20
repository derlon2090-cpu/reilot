import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("../../src/server/db.js", () => ({
  query: queryMock,
  transaction: (run: (client: { query: typeof queryMock }) => Promise<unknown>) => run({ query: queryMock })
}));
vi.mock("../../src/server/session.js", () => ({
  requireSession: async () => ({ ok: true, session: { userId: "user-1", tenantId: "tenant-1", role: "owner" } })
}));

import { PATCH } from "../../app/api/settings/profile/route.js";

describe("store name sync from profile", () => {
  beforeEach(() => queryMock.mockReset());

  it("updates the store and the admin workspace name in one transaction", async () => {
    queryMock.mockImplementation(async (sql: string) => ({
      rows: String(sql).includes("UPDATE stores") ? [{ id: "store-1" }] : []
    }));
    const response = await PATCH(new Request("http://localhost/api/settings/profile", {
      method: "PATCH", body: JSON.stringify({ fullName: "Waleed Ali", storeName: "متجر وليد الجديد" })
    }));
    expect(response.status).toBe(200);
    expect(queryMock.mock.calls.some(([sql, values]) => String(sql).includes("UPDATE stores") && values[0] === "متجر وليد الجديد")).toBe(true);
    expect(queryMock.mock.calls.some(([sql, values]) => String(sql).includes("UPDATE tenants") && values[0] === "متجر وليد الجديد")).toBe(true);
  });

  it("creates a store record if the workspace has none", async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const response = await PATCH(new Request("http://localhost/api/settings/profile", {
      method: "PATCH", body: JSON.stringify({ fullName: "Waleed Ali", storeName: "متجر جديد" })
    }));
    expect(response.status).toBe(200);
    expect(queryMock.mock.calls.some(([sql, values]) => String(sql).includes("INSERT INTO stores") && values[1] === "متجر جديد")).toBe(true);
  });
});
