import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.fn();
const query = vi.fn();
const requireSession = vi.fn();
const getSallaAccessToken = vi.fn();
const ensureSallaCustomerLoginWebhook = vi.fn();

vi.mock("../../src/server/db.js", () => ({
  query,
  transaction
}));

vi.mock("../../src/server/session.js", () => ({
  requireSession
}));

vi.mock("../../src/server/salla-app.js", () => ({
  getSallaAccessToken,
  ensureSallaCustomerLoginWebhook
}));

const { PATCH } = await import("../../app/api/settings/store-customer-sync/route.js");

describe("store customer sync setting", () => {
  beforeEach(() => {
    transaction.mockReset();
    query.mockReset();
    requireSession.mockReset();
    getSallaAccessToken.mockReset();
    ensureSallaCustomerLoginWebhook.mockReset();
    requireSession.mockResolvedValue({
      ok: true,
      session: { tenantId: "tenant-1", userId: "user-1" }
    });
    query.mockResolvedValue({ rows: [{
      id: "connection-1",
      access_token_encrypted: "encrypted-token",
      refresh_token_encrypted: "encrypted-refresh",
      token_expires_at: new Date(Date.now() + 60_000).toISOString()
    }] });
    getSallaAccessToken.mockResolvedValue("access-token");
    ensureSallaCustomerLoginWebhook.mockResolvedValue({ registered: true, event: "customer.login" });
  });

  it("updates the existing Salla customer synchronization flag", async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes("FROM app_connections")) return { rows: [{ id: "connection-1" }] };
        return { rows: [] };
      })
    };
    transaction.mockImplementationOnce((callback) => callback(client));

    const response = await PATCH(new Request("https://renvix.app/api/settings/store-customer-sync", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: true })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, available: true, enabled: true });
    expect(queries.some((sql) => sql.includes("auto_sync_customers = EXCLUDED.auto_sync_customers"))).toBe(true);
    expect(queries.some((sql) => sql.includes("settings.store_customer_sync_updated"))).toBe(true);
    expect(ensureSallaCustomerLoginWebhook).toHaveBeenCalledWith("access-token", "https://renvix.app");
  });

  it("does not enable synchronization without a connected store", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const response = await PATCH(new Request("https://renvix.app/api/settings/store-customer-sync", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: true })
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("storefront login customer capture contract", () => {
  const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
  const sallaSource = readFileSync(new URL("../../src/server/salla-app.js", import.meta.url), "utf8");
  const settingsSource = readFileSync(new URL("../../app/api/settings/route.js", import.meta.url), "utf8");

  it("removes the embedded newsletter preview and exposes one settings toggle", () => {
    expect(appSource).not.toContain('class="newsletter-preview"');
    expect(appSource).toContain('data-action="store-customer-sync-toggle"');
    expect(appSource).toContain('/api/settings/store-customer-sync');
    expect(settingsSource).toContain('AS "storeCustomerSyncEnabled"');
  });

  it("registers and processes customer.login behind the shared Salla flag", () => {
    expect(sallaSource).toContain('"customer.created", "customer.updated", "customer.login"');
    expect(sallaSource).toContain('["customer.created", "customer.updated", "customer.login"].includes(event)');
    expect(sallaSource).toContain('if (isCustomer && !connection.auto_sync_customers)');
    expect(sallaSource).toContain("external_customer_id");
  });
});
