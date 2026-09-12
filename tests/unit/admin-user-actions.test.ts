import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditMock, clientQueryMock, transactionMock } = vi.hoisted(() => ({
  auditMock: vi.fn(), clientQueryMock: vi.fn(), transactionMock: vi.fn()
}));

vi.mock("../../src/server/admin-auth.js", () => ({
  requireAdminPermission: vi.fn(async () => ({ ok: true, admin: { adminId: "admin-1", userId: "admin-user" } })),
  auditAdmin: auditMock
}));
vi.mock("../../src/server/db.js", () => ({ transaction: transactionMock }));
vi.mock("../../src/server/security.js", () => ({ safeErrorMessage: (error: Error) => error.message }));

import { POST } from "../../app/api/admin/users/[userId]/actions/route.js";

const userId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";
const email = "customer@example.com";

function call(body: Record<string, unknown>) {
  return POST(new Request(`http://localhost/api/admin/users/${userId}/actions`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  }), { params: Promise.resolve({ userId }) });
}

describe("admin user lifecycle actions", () => {
  beforeEach(() => {
    auditMock.mockReset();
    clientQueryMock.mockReset();
    transactionMock.mockReset();
    transactionMock.mockImplementation(async (callback) => callback({ query: clientQueryMock }));
  });

  it("suspends only the selected user and expires only that user's sessions", async () => {
    clientQueryMock.mockImplementation(async (sql) => {
      const statement = String(sql);
      if (statement.includes("FROM users u")) return { rows: [{ id: userId, email, status: "active", tenantId, isAdmin: false }] };
      if (statement.includes("UPDATE sessions")) return { rows: [{ id: "session-1" }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const response = await call({ action: "suspend_user", confirmation: email });
    expect(response.status).toBe(200);
    expect(clientQueryMock.mock.calls.some(([sql, params]) => String(sql).includes("UPDATE users SET account_status=$2") && params[0] === userId && params[1] === "suspended")).toBe(true);
    expect(clientQueryMock.mock.calls.some(([sql, params]) => String(sql).includes("UPDATE sessions") && params.length === 1 && params[0] === userId)).toBe(true);
    expect(clientQueryMock.mock.calls.some(([sql, params]) => String(sql).includes("UPDATE auth_pending_registrations") && params[0] === email)).toBe(true);
    expect(clientQueryMock.mock.calls.some(([sql, params]) => String(sql).includes("UPDATE password_reset_codes") && params[0] === userId)).toBe(true);
    expect(clientQueryMock.mock.calls.some(([sql, params]) => String(sql).includes("UPDATE auth_trusted_devices") && params[0] === userId)).toBe(true);
    expect(clientQueryMock.mock.calls.some(([sql]) => String(sql).includes("UPDATE tenants"))).toBe(false);
  });

  it("protects active administrator accounts", async () => {
    clientQueryMock.mockResolvedValue({ rows: [{ id: userId, email, status: "active", tenantId, isAdmin: true }] });
    const response = await call({ action: "remove_user", confirmation: email });
    expect(response.status).toBe(403);
    expect((await response.json()).reason).toBe("admin_user_cannot_be_changed");
  });

  it("requires the exact email for destructive actions", async () => {
    clientQueryMock.mockResolvedValue({ rows: [{ id: userId, email, status: "active", tenantId, isAdmin: false }] });
    const response = await call({ action: "suspend_user", confirmation: "wrong@example.com" });
    expect(response.status).toBe(400);
    expect(clientQueryMock.mock.calls.some(([sql]) => String(sql).includes("UPDATE users SET"))).toBe(false);
  });

  it("keeps individual actions separate from workspace actions in the UI", () => {
    const source = readFileSync(resolve("src/components/admin/AdminSections.jsx"), "utf8");
    expect(source).toContain("function UserActions");
    expect(source).toContain("/api/admin/users/${row.id}/actions");
    expect(source).toContain("دون التأثير على بقية أعضاء مساحة العمل");
    expect(source).toMatch(/function Customers[\s\S]*?<UserActions/);
    expect(source).toMatch(/function Subscriptions[\s\S]*?<TenantActions/);
  });

  it("ships the account lifecycle migration", () => {
    const migration = readFileSync(resolve("drizzle/0097_user_account_lifecycle.sql"), "utf8");
    expect(migration).toContain("account_status text NOT NULL DEFAULT 'active'");
    expect(migration).toContain("'active','suspended','removed'");
  });
});
