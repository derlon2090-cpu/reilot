import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clientQuery: vi.fn(),
  query: vi.fn(),
  provisionCustomerAccount: vi.fn()
}));

vi.mock("../../src/server/db.js", () => ({
  query: mocks.query,
  transaction: async (callback: (client: { query: typeof mocks.clientQuery }) => unknown) =>
    callback({ query: mocks.clientQuery })
}));

vi.mock("../../src/server/provisioning.js", () => ({
  provisionCustomerAccount: mocks.provisionCustomerAccount
}));

import {
  normalizeProvisioningPurchase,
  processSallaProvisioningPurchase,
  queueSallaProvisioningJobs
} from "../../src/server/salla-provisioning.js";

const paidPurchase = {
  event: "order.payment.completed",
  store: { id: "salla-store-1" },
  data: {
    id: "order-9001",
    payment_status: "paid",
    customer: {
      name: "عميل Renvix",
      email: "Customer@Example.com",
      mobile: "0501234567",
      country_code: "SA"
    },
    items: [
      { id: "item-basic", product_id: "product-basic", sku: "BASIC", quantity: 1 },
      { id: "item-pro", product_id: "product-pro", sku: "PRO", quantity: 1 }
    ]
  }
};

describe("Salla paid-purchase account provisioning", () => {
  const createdJobs: unknown[][] = [];

  beforeEach(() => {
    createdJobs.length = 0;
    mocks.clientQuery.mockReset();
    mocks.query.mockReset();
    mocks.provisionCustomerAccount.mockReset().mockResolvedValue({ status: "sending_credentials" });
    mocks.clientQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("INSERT INTO provisioning_webhook_events")) {
        return { rowCount: 1, rows: [{ id: "event-1" }] };
      }
      if (sql.includes("FROM provisioning_product_mappings")) {
        const productId = params[2];
        if (productId === "product-basic") {
          return { rowCount: 1, rows: [{ id: "mapping-basic", planId: "plan-basic", durationValue: 1, durationUnit: "month", quantityBehavior: "extend_duration", activationTrigger: "payment_completed" }] };
        }
        if (productId === "product-pro") {
          return { rowCount: 1, rows: [{ id: "mapping-pro", planId: "plan-pro", durationValue: 1, durationUnit: "year", quantityBehavior: "extend_duration", activationTrigger: "payment_completed" }] };
        }
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes("INSERT INTO account_provisioning_jobs")) {
        createdJobs.push(params);
        return { rowCount: 1, rows: [{ id: `job-${createdJobs.length}` }] };
      }
      return { rowCount: 1, rows: [] };
    });
  });

  it("normalizes the Salla buyer and recognizes a completed payment", () => {
    const purchase = normalizeProvisioningPurchase(paidPurchase, { eventId: "evt-paid-1" });
    expect(purchase.paymentCompleted).toBe(true);
    expect(purchase.customer.email).toBe("customer@example.com");
    expect(purchase.customer.phone).toBe("+966501234567");
    expect(purchase.items).toHaveLength(2);
  });

  it("accepts the merchant identity used by operational Salla webhooks", () => {
    const merchantPayload = structuredClone(paidPurchase);
    delete (merchantPayload as { store?: unknown }).store;
    (merchantPayload as typeof paidPurchase & { merchant: number }).merchant = 778899;
    const purchase = normalizeProvisioningPurchase(merchantPayload, { eventId: "evt-merchant" });
    expect(purchase.storeId).toBe("778899");
  });

  it("creates independent jobs with the exact purchased plan for two plans", async () => {
    const result = await queueSallaProvisioningJobs(paidPurchase, { eventId: "evt-paid-2" });
    expect(result).toMatchObject({ ok: true, queued: true, duplicate: false });
    expect(result.ids).toEqual(["job-1", "job-2"]);
    expect(createdJobs).toHaveLength(2);
    expect(createdJobs[0][6]).toBe("plan-basic");
    expect(createdJobs[1][6]).toBe("plan-pro");
    expect(createdJobs[0][2]).toBe("customer@example.com");
  });

  it("processes each queued plan exactly once", async () => {
    const result = await processSallaProvisioningPurchase(paidPurchase, { eventId: "evt-paid-3" });
    expect(result.completed).toEqual(["job-1", "job-2"]);
    expect(result.failed).toEqual([]);
    expect(mocks.provisionCustomerAccount).toHaveBeenNthCalledWith(1, "job-1");
    expect(mocks.provisionCustomerAccount).toHaveBeenNthCalledWith(2, "job-2");
  });

  it("does not create an account before payment completion", async () => {
    const unpaid = structuredClone(paidPurchase);
    unpaid.event = "order.created";
    unpaid.data.payment_status = "pending";
    const result = await processSallaProvisioningPurchase(unpaid, { eventId: "evt-unpaid" });
    expect(result).toMatchObject({ queued: false, ignored: "payment_not_completed", completed: [] });
    expect(mocks.clientQuery).not.toHaveBeenCalled();
    expect(mocks.provisionCustomerAccount).not.toHaveBeenCalled();
  });

  it("treats a repeated Salla event as idempotent", async () => {
    mocks.clientQuery.mockImplementationOnce(async () => ({ rowCount: 0, rows: [] }));
    const result = await processSallaProvisioningPurchase(paidPurchase, { eventId: "evt-duplicate" });
    expect(result).toMatchObject({ duplicate: true, queued: false, completed: [] });
    expect(mocks.provisionCustomerAccount).not.toHaveBeenCalled();
  });

  it("runs provisioning from the operational webhook worker registered with Salla", () => {
    const workerSource = readFileSync(resolve("src/server/salla-app.js"), "utf8");
    expect(workerSource).toContain("await processSallaProvisioningPurchase(item.payload);");
  });
});
