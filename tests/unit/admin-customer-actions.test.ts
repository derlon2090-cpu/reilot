import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditMock, clientQueryMock, transactionMock } = vi.hoisted(() => ({
  auditMock: vi.fn(),
  clientQueryMock: vi.fn(),
  transactionMock: vi.fn()
}));

vi.mock("../../src/server/admin-auth.js", () => ({
  requireAdminPermission: vi.fn(async () => ({
    ok: true,
    admin: { adminId: "admin-1", userId: "admin-user-1", email: "admin@renvix.app" }
  })),
  auditAdmin: auditMock
}));

vi.mock("../../src/server/db.js", () => ({ transaction: transactionMock }));
vi.mock("../../src/server/security.js", () => ({ safeErrorMessage: (error: Error) => error.message }));

import { POST } from "../../app/api/admin/tenants/[tenantId]/actions/route.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const planId = "22222222-2222-4222-8222-222222222222";

function request(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/admin/tenants/${tenantId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function call(body: Record<string, unknown>) {
  return POST(request(body), { params: Promise.resolve({ tenantId }) });
}

describe("admin customer actions", () => {
  beforeEach(() => {
    auditMock.mockReset();
    clientQueryMock.mockReset();
    transactionMock.mockReset();
    transactionMock.mockImplementation(async (callback) => callback({ query: clientQueryMock }));
  });

  it("adds genuine wallet credit and records the administrative transaction", async () => {
    clientQueryMock.mockImplementation(async (sql) => {
      const statement = String(sql);
      if (statement.includes("FROM tenants")) return { rows: [{ id: tenantId, name: "متجر الندى", status: "active" }] };
      if (statement.includes("FROM whatsapp_wallets") && statement.includes("FOR UPDATE")) return { rows: [{ id: "wallet-1", availableBalance: "25.5000" }] };
      if (statement.includes("INSERT INTO whatsapp_wallet_transactions")) return { rows: [{ id: "transaction-1" }] };
      return { rows: [], rowCount: 0 };
    });

    const response = await call({ action: "add_credit", amount: 100.5, note: "تعويض معتمد" });
    const payload = await response.json();

    expect(response.status, JSON.stringify(payload)).toBe(200);
    expect(payload.result.balance).toBe(126);
    expect(clientQueryMock.mock.calls.some(([sql]) => String(sql).includes("available_balance=$2"))).toBe(true);
    const ledgerInsert = clientQueryMock.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO whatsapp_wallet_transactions"));
    expect(ledgerInsert?.[1]).toContain(100.5);
    expect(ledgerInsert?.[1]).toContain("تعويض معتمد");
  });

  it("changes the latest platform subscription to an active real plan", async () => {
    clientQueryMock.mockImplementation(async (sql) => {
      const statement = String(sql);
      if (statement.includes("FROM tenants")) return { rows: [{ id: tenantId, name: "متجر الندى", status: "active" }] };
      if (statement.includes("FROM platform_plans")) return { rows: [{ id: planId, name: "الاحترافية", slug: "pro" }] };
      if (statement.includes("FROM platform_subscriptions") && statement.includes("FOR UPDATE")) return { rows: [{ id: "subscription-1", planId: "old-plan" }] };
      return { rows: [], rowCount: 1 };
    });

    const response = await call({ action: "change_plan", planId });
    const payload = await response.json();

    expect(response.status, JSON.stringify(payload)).toBe(200);
    expect(payload.result.plan.id).toBe(planId);
    expect(clientQueryMock.mock.calls.some(([sql, params]) => String(sql).includes("UPDATE platform_subscriptions") && params.includes(planId))).toBe(true);
  });

  it("requires the exact workspace name before removing a customer", async () => {
    clientQueryMock.mockImplementation(async (sql) => String(sql).includes("FROM tenants")
      ? { rows: [{ id: tenantId, name: "متجر الندى", status: "active" }] }
      : { rows: [], rowCount: 0 });

    const response = await call({ action: "remove_customer", confirmation: "اسم غير مطابق" });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.reason).toBe("confirmation_mismatch");
    expect(clientQueryMock.mock.calls.some(([sql]) => String(sql).includes("UPDATE tenants SET status='disabled'"))).toBe(false);
  });

  it("protects a workspace that contains an active admin account", async () => {
    clientQueryMock.mockImplementation(async (sql) => {
      const statement = String(sql);
      if (statement.includes("FROM tenants")) return { rows: [{ id: tenantId, name: "متجر الإدارة", status: "active" }] };
      if (statement.includes("FROM admin_users")) return { rows: [{ exists: 1 }] };
      return { rows: [], rowCount: 0 };
    });

    const response = await call({ action: "remove_customer", confirmation: "متجر الإدارة" });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.reason).toBe("admin_tenant_cannot_be_removed");
    expect(clientQueryMock.mock.calls.some(([sql]) => String(sql).includes("UPDATE tenants SET status='disabled'"))).toBe(false);
  });

  it("soft-removes the customer, cancels subscriptions, and expires sessions without deleting records", async () => {
    clientQueryMock.mockImplementation(async (sql) => {
      const statement = String(sql);
      if (statement.includes("FROM tenants")) return { rows: [{ id: tenantId, name: "متجر الندى", status: "active" }] };
      if (statement.includes("FROM admin_users")) return { rows: [] };
      if (statement.includes("UPDATE sessions")) return { rows: [{ id: "session-1" }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });

    const response = await call({ action: "remove_customer", confirmation: "متجر الندى" });
    const payload = await response.json();
    expect(response.status, JSON.stringify(payload)).toBe(200);
    expect(clientQueryMock.mock.calls.some(([sql]) => String(sql).includes("UPDATE tenants SET status='disabled'"))).toBe(true);
    expect(clientQueryMock.mock.calls.some(([sql]) => String(sql).includes("UPDATE platform_subscriptions SET status='cancelled'"))).toBe(true);
    expect(clientQueryMock.mock.calls.some(([sql]) => /^\s*DELETE\s/i.test(String(sql)))).toBe(false);
  });

  it("renders all three guarded actions beside subscriptions and stores", () => {
    const source = readFileSync(resolve("src/components/admin/AdminSections.jsx"), "utf8");
    expect(source.match(/label: "إدارة العميل"/g)).toHaveLength(2);
    expect(source).toContain('open("add_credit")');
    expect(source).toContain('open("change_plan")');
    expect(source).toContain('open("remove_customer")');
    expect(source).toContain("اكتب اسم مساحة العمل للتأكيد");
  });
});
