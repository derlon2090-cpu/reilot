import { describe, expect, it } from "vitest";
import { exportTenantCsv, filterByTenant, getTenantRecord } from "../../src/lib/tenant.js";

describe("tenant isolation integration", () => {
  const records = [
    { id: "a-customer", tenantId: "tenant-a", name: "A Customer" },
    { id: "b-customer", tenantId: "tenant-b", name: "B Customer" }
  ];

  it("filters lists, direct access, and CSV exports by tenant", () => {
    expect(filterByTenant(records, "tenant-a")).toHaveLength(1);
    expect(getTenantRecord(records, "tenant-a", "b-customer").status).toBe(403);
    expect(exportTenantCsv(records, "tenant-a")).toContain("a-customer");
    expect(exportTenantCsv(records, "tenant-a")).not.toContain("b-customer");
  });
});
