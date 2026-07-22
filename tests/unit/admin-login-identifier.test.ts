import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, auditMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  auditMock: vi.fn()
}));

vi.mock("../../src/server/admin-auth.js", () => ({
  auditAdmin: auditMock,
  requestIp: () => "127.0.0.1"
}));
vi.mock("../../src/server/db.js", () => ({
  query: queryMock,
  transaction: async (callback: (client: { query: ReturnType<typeof vi.fn> }) => unknown) => callback({ query: vi.fn() })
}));
vi.mock("../../src/server/password.js", () => ({ verifyPassword: vi.fn(async () => true) }));
vi.mock("../../src/server/session.js", () => ({
  createSession: vi.fn(async () => ({ token: "admin-session" })),
  destroySession: vi.fn(async () => undefined),
  sessionCookie: () => "renewpilot_session=admin-session; HttpOnly"
}));

import { POST } from "../../app/api/admin/auth/login/route.js";

describe("admin login identifiers", () => {
  beforeEach(() => {
    queryMock.mockReset();
    auditMock.mockReset();
  });

  it("accepts the permanent administrator username without weakening credential verification", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{
        userId: "user-1",
        name: "Renvix Admin",
        email: "admin@renvix.app",
        password: "stored-hash",
        adminId: "admin-1",
        adminRole: "super_admin",
        status: "active",
        mfaEnabled: false,
        expiresAt: null
      }] })
      .mockResolvedValue({ rows: [] });

    const response = await POST(new Request("http://localhost/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "renvix_root_7X9K", password: "A-very-strong-password", rememberMe: false })
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(queryMock.mock.calls[1][0]).toContain("lower(a.account_id)");
    expect(auditMock).toHaveBeenCalledWith(expect.any(Request), expect.objectContaining({ action: "admin.login.success" }));
  });
});
