import { describe, expect, it } from "vitest";
import { assertPermission, assertTenantAccess, can } from "../../src/lib/permissions.js";

describe("permissions", () => {
  it("allows owners to manage resources and blocks viewer mutations", () => {
    expect(can("owner", "delete:any")).toBe(true);
    expect(assertPermission("viewer", "delete:any")).toEqual({ ok: false, status: 403, error: "Permission denied" });
  });

  it("blocks cross-tenant access", () => {
    expect(assertTenantAccess("tenant-a", "tenant-a").ok).toBe(true);
    expect(assertTenantAccess("tenant-a", "tenant-b").status).toBe(403);
  });
});
