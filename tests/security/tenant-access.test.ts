import { describe, expect, it } from "vitest";
import { assertTenantAccess } from "../../src/lib/permissions.js";
import { getTenantRecord } from "../../src/lib/tenant.js";

describe("tenant access security", () => {
  it("returns 403 for cross-tenant object ids", () => {
    expect(assertTenantAccess("tenant-a", "tenant-b").status).toBe(403);
    expect(getTenantRecord([{ id: "channel-b", tenantId: "tenant-b", name: "B" }], "tenant-a", "channel-b")).toMatchObject({ ok: false, status: 403 });
  });
});
