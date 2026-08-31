import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  query: vi.fn()
}));

vi.mock("../../src/server/session.js", () => ({
  ADMIN_SESSION_COOKIE: "renvix_admin_session",
  getSession: mocks.getSession
}));
vi.mock("../../src/server/db.js", () => ({ query: mocks.query }));

import { getAdminContext, requireAdminPermission } from "../../src/server/admin-auth.js";

const request = new Request("https://admin.renvix.app/api/admin/overview");

describe("server-side administrator authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ id: "session-1", userId: "user-1" });
  });

  it("denies an ordinary authenticated customer with no active admin record", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    expect(await getAdminContext(request)).toBeNull();
    mocks.query.mockReset().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const result = await requireAdminPermission(request, "overview", "read");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("allows an active administrator with a server-side role", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ adminId: "admin-1", adminRole: "super_admin", status: "active", userId: "user-1" }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await requireAdminPermission(request, "overview", "read");
    expect(result.ok).toBe(true);
  });
});
