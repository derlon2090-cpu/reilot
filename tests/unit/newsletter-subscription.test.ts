import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.fn();
const assertPlanCapacity = vi.fn();

vi.mock("../../src/server/db.js", () => ({
  query: vi.fn(),
  transaction
}));

vi.mock("../../src/server/plan-entitlements.js", () => ({
  assertPlanCapacity,
  planEntitlementResponse: vi.fn()
}));

const { subscribeToNewsletter } = await import("../../src/server/newsletter.js");

describe("tenant newsletter subscriptions", () => {
  beforeEach(() => {
    transaction.mockReset();
    assertPlanCapacity.mockReset();
  });

  it("creates a customer in the link owner's tenant and records the source", async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes("FROM newsletter_profiles")) return { rows: [{ id: "profile-1", publicId: "nl_test", tenantId: "tenant-1", ownerUserId: "user-1", displayName: "متجر الاختبار" }] };
        if (sql.includes("FROM newsletter_subscribers")) return { rows: [] };
        if (sql.includes("FROM customers")) return { rows: [] };
        if (sql.includes("INSERT INTO customers")) return { rows: [{ id: "customer-1" }] };
        return { rows: [] };
      })
    };
    transaction.mockImplementationOnce((callback) => callback(client));

    await expect(subscribeToNewsletter("nl_test", " PERSON@Example.com ")).resolves.toMatchObject({
      customerId: "customer-1",
      alreadySubscribed: false
    });
    expect(assertPlanCapacity).toHaveBeenCalledWith("tenant-1", "customers", client);
    expect(queries.some((sql) => sql.includes("INSERT INTO newsletter_subscribers"))).toBe(true);
    expect(queries.some((sql) => sql.includes("newsletter.subscribed"))).toBe(true);
  });

  it("is idempotent when the same email subscribes again", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM newsletter_profiles")) return { rows: [{ id: "profile-1", publicId: "nl_test", tenantId: "tenant-1", ownerUserId: "user-1", displayName: "متجر الاختبار" }] };
        if (sql.includes("FROM newsletter_subscribers")) return { rows: [{ customerId: "customer-1" }] };
        return { rows: [] };
      })
    };
    transaction.mockImplementationOnce((callback) => callback(client));

    await expect(subscribeToNewsletter("nl_test", "person@example.com")).resolves.toMatchObject({
      customerId: "customer-1",
      alreadySubscribed: true
    });
    expect(assertPlanCapacity).not.toHaveBeenCalled();
  });
});

describe("newsletter and storage UI contract", () => {
  const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");

  it("uses the account-specific public link and real customer-creating form", () => {
    expect(appSource).toContain("/newsletter/subscribe/${encodeURIComponent(newsletterPublicId)}");
    expect(appSource).toContain('data-submit="tenant-newsletter"');
    expect(appSource).toContain("/api/public/newsletter/${encodeURIComponent(newsletterPublicId)}");
  });

  it("shows MB up to 1000 MB and GB only above it", () => {
    expect(appSource).toContain("if (mb > 1000)");
    expect(appSource).toContain("< 0.01 MB");
    expect(appSource).toContain("Math.min(100");
  });
});
