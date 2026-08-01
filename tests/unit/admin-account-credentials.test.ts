import { beforeEach, describe, expect, it, vi } from "vitest";
import { isStrongPassword } from "../../src/server/security.js";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  clientQuery: vi.fn(),
  hashPassword: vi.fn()
}));

vi.mock("../../src/server/db.js", () => ({
  query: mocks.query,
  transaction: async (callback: (client: { query: typeof mocks.clientQuery }) => unknown) =>
    callback({ query: mocks.clientQuery })
}));

vi.mock("../../src/server/password.js", () => ({
  hashPassword: mocks.hashPassword
}));

import { resolveAccountEvent } from "../../src/server/admin-template-events.js";

const accountRow = {
  id: "job-1",
  userId: "user-1",
  tenantId: "tenant-1",
  customerName: "عميل Renvix",
  customerEmail: "buyer@example.com",
  email: "buyer@example.com",
  phone: "+966501234567",
  activatedAt: new Date("2026-08-01T10:00:00Z"),
  planName: "الباقة الاحترافية",
  subscriptionExpiry: new Date("2027-08-01T10:00:00Z")
};

describe("account-created admin email credentials", () => {
  beforeEach(() => {
    mocks.query.mockReset().mockResolvedValue({
      rowCount: 1,
      rows: [accountRow]
    });
    mocks.clientQuery.mockReset().mockResolvedValue({ rowCount: 1, rows: [] });
    mocks.hashPassword.mockReset().mockImplementation(async (password: string) => `hashed:${password}`);
  });

  it.each(["الباقة الأساسية", "الباقة الاحترافية"])(
    "emails %s with a strong one-time password matching the stored hash",
    async (planName) => {
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [{ ...accountRow, planName }] });
    const resolved = await resolveAccountEvent({
      aggregate_id: "job-1",
      payload_refs: { provisioningJobId: "job-1" }
    }, "email");

    expect(resolved.recipient).toBe("buyer@example.com");
    expect(resolved.variables.plan_name).toBe(planName);
    expect(resolved.variables.customer_email).toBe("buyer@example.com");
    expect(isStrongPassword(resolved.variables.temporary_password)).toBe(true);
    expect(resolved.variables.temporary_password.length).toBeGreaterThanOrEqual(20);
    expect(mocks.hashPassword).toHaveBeenCalledWith(resolved.variables.temporary_password);
    expect(mocks.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE accounts SET password"),
      [`hashed:${resolved.variables.temporary_password}`, "user-1"]
    );
    expect(mocks.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("must_change_password=true"),
      ["user-1"]
    );
    expect(resolved.sensitiveVariables).toContain("temporary_password");
  });
});
