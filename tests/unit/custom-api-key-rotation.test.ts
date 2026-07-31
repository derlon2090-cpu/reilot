import { beforeEach, describe, expect, it, vi } from "vitest";

const { clientQueryMock, queryMock, transactionMock } = vi.hoisted(() => ({
  clientQueryMock: vi.fn(),
  queryMock: vi.fn(),
  transactionMock: vi.fn()
}));

vi.mock("../../src/server/session.js", () => ({
  requireSession: vi.fn(async () => ({
    ok: true,
    session: { tenantId: "tenant-1", userId: "user-1", role: "owner" }
  }))
}));

vi.mock("../../src/server/db.js", () => ({
  query: queryMock,
  transaction: transactionMock
}));

vi.mock("../../src/server/plan-entitlements.js", () => ({
  requirePlanEntitlement: vi.fn(async () => ({ enabled: true })),
  planEntitlementResponse: vi.fn(() => null)
}));

import { POST } from "../../app/api/integrations/custom/[integrationId]/keys/route.js";

describe("custom API key replacement", () => {
  beforeEach(() => {
    process.env.CUSTOM_API_KEY_PEPPER = "custom-key-rotation-test-pepper-long-enough";
    queryMock.mockReset();
    clientQueryMock.mockReset();
    transactionMock.mockReset();
    queryMock
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ environment: "test", scopes: ["customers:read"] }] });
    transactionMock.mockImplementation(async (callback) => callback({ query: clientQueryMock }));
    clientQueryMock.mockImplementation(async (sql, params = []) => {
      if (String(sql).includes("INSERT INTO custom_integration_api_keys")) {
        return { rows: [{ id: "key-new", name: "مفتاح API", prefix: params[4], scopes: ["customers:read"], createdAt: "2026-07-31T00:00:00.000Z" }] };
      }
      return { rows: [] };
    });
  });

  it("revokes the current key under a lock before inserting its replacement", async () => {
    const response = await POST(new Request("http://localhost/api/integrations/custom/integration-1/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "المفتاح البديل" })
    }), { params: Promise.resolve({ integrationId: "integration-1" }) });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.apiKey).toMatch(/^rvx_test_/);
    const statements = clientQueryMock.mock.calls.map(([sql]) => String(sql));
    expect(statements[0]).toContain("pg_advisory_xact_lock");
    expect(statements.findIndex((sql) => sql.includes("UPDATE custom_integration_api_keys")))
      .toBeLessThan(statements.findIndex((sql) => sql.includes("INSERT INTO custom_integration_api_keys")));
    expect(statements.filter((sql) => sql.includes("INSERT INTO custom_integration_api_keys"))).toHaveLength(1);
  });
});
