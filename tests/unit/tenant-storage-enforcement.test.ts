import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  getTenantStorageLimitState,
  requestNeedsStorageCapacity,
  storageLimitResponse
} from "../../src/server/tenant-storage.js";

describe("tenant storage enforcement", () => {
  it("blocks new writes as soon as the plan storage limit is reached", async () => {
    const runner = {
      query: vi.fn(async () => ({ rows: [{ usedBytes: 1_929_379, limitMb: 1 }] }))
    };
    const storage = await getTenantStorageLimitState("tenant-1", runner);

    expect(storage).toMatchObject({
      usedMb: 1.84,
      limitMb: 1,
      percent: 184,
      progressPercent: 100,
      remainingBytes: 0,
      isLimitReached: true,
      isOverLimit: true
    });
    const response = storageLimitResponse(storage);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      reason: "storage_limit_reached",
      upgrade_required: true,
      deletion_allowed: true
    });
  });

  it("guards data-producing requests while keeping deletion and upgrades available", () => {
    expect(requestNeedsStorageCapacity(new Request("https://renvix.app/api/customers", { method: "POST" }))).toBe(true);
    expect(requestNeedsStorageCapacity(new Request("https://renvix.app/api/order-link/profile/logo", { method: "POST" }))).toBe(true);
    expect(requestNeedsStorageCapacity(new Request("https://renvix.app/api/settings/profile/avatar", { method: "POST" }))).toBe(true);
    expect(requestNeedsStorageCapacity(new Request("https://renvix.app/api/support/tickets/ticket-1/attachments", { method: "POST" }))).toBe(true);
    expect(requestNeedsStorageCapacity(new Request("https://renvix.app/api/customers/customer-1", { method: "DELETE" }))).toBe(false);
    expect(requestNeedsStorageCapacity(new Request("https://renvix.app/api/apps/salla/disconnect", { method: "POST" }))).toBe(false);
    expect(requestNeedsStorageCapacity(new Request("https://renvix.app/api/billing/whatsapp/top-up", { method: "POST" }))).toBe(false);
    expect(requestNeedsStorageCapacity(new Request("https://renvix.app/api/order-link/profile", { method: "POST" }))).toBe(false);
  });

  it("allows a write while capacity remains", async () => {
    const runner = {
      query: vi.fn(async () => ({ rows: [{ usedBytes: 512_000, limitMb: 1 }] }))
    };
    await expect(getTenantStorageLimitState("tenant-1", runner)).resolves.toMatchObject({
      isLimitReached: false,
      isOverLimit: false,
      remainingBytes: 536_576
    });
  });
});

describe("storage limit upgrade navigation", () => {
  const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");

  it("closes the quota modal and opens the plans tab directly", () => {
    expect(appSource).toContain('data-action="upgrade-storage-plan"');
    expect(appSource).toContain('if (action === "upgrade-storage-plan")');
    expect(appSource).toContain('state.billingTab = "plans"');
    expect(appSource).toContain('storage.set("renvix.billing.tab", "plans")');
    expect(appSource).toMatch(/if \(action === "upgrade-storage-plan"\)[\s\S]*?closePortal\(\);[\s\S]*?navigate\("\/dashboard\/billing"\)/);
  });
});
