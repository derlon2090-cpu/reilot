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

import { POST } from "../../app/api/integrations/custom/route.js";
import { verifyApiKeyDigest } from "../../src/server/custom-integrations.js";

describe("custom integration creation route", () => {
  beforeEach(() => {
    process.env.CUSTOM_API_KEY_PEPPER = "custom-api-route-test-pepper-long-enough";
    clientQueryMock.mockReset();
    queryMock.mockReset();
    transactionMock.mockReset();
    transactionMock.mockImplementation(async (callback) => callback({ query: clientQueryMock }));
    clientQueryMock.mockImplementation(async (sql, params = []) => {
      const statement = String(sql);
      if (statement.includes("INSERT INTO custom_integrations")) {
        return {
          rows: [{
            id: "integration-1",
            name: "نظام المتجر",
            environment: "test",
            direction: "bidirectional",
            status: "PARTIALLY_CONFIGURED"
          }]
        };
      }
      if (statement.includes("INSERT INTO custom_integration_api_keys")) {
        return {
          rows: [{
            id: "key-1",
            name: "المفتاح الرئيسي",
            prefix: params[4],
            scopes: JSON.parse(params[7]),
            status: "ACTIVE",
            createdAt: "2026-07-30T20:00:00.000Z"
          }]
        };
      }
      return { rows: [] };
    });
  });

  it("returns the genuine one-time key and its manageable database record", async () => {
    const response = await POST(new Request("http://localhost/api/integrations/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "نظام المتجر",
        environment: "test",
        direction: "bidirectional",
        scopes: ["customers:read", "messages:send"]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.item.id).toBe("integration-1");
    expect(payload.key).toMatchObject({ id: "key-1", status: "ACTIVE" });
    expect(payload.apiKey).toMatch(/^rvx_test_[a-f0-9]{32}_[A-Za-z0-9_-]{40,}$/);
    expect(payload.key.prefix).toBe(payload.apiKey.split("_").slice(0, 3).join("_"));

    const keyInsert = clientQueryMock.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO custom_integration_api_keys")
    );
    expect(keyInsert).toBeTruthy();
    expect(keyInsert[0]).toContain("RETURNING id,name,key_prefix AS prefix");
    expect(keyInsert[1]).not.toContain(payload.apiKey);
    expect(verifyApiKeyDigest(payload.apiKey, keyInsert[1][5])).toBe(true);
  });
});
