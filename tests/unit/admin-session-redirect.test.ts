import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("../../src/server/db.js", () => ({ query: queryMock }));

import { getSession } from "../../src/server/session.js";

describe("admin session redirect", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [{ id: "session-1", userId: "user-1" }] });
  });

  it("keeps disabled tenants blocked for ordinary user sessions", async () => {
    await getSession(new Request("https://renvix.app/dashboard", {
      headers: { cookie: "renewpilot_session=ordinary-token" }
    }));

    expect(queryMock.mock.calls[0][0]).toContain("AND t.status <> 'disabled'");
  });

  it("allows the admin control plane to validate its session independently", async () => {
    await getSession(new Request("https://renvix.app/admin", {
      headers: { cookie: "renewpilot_session=admin-token" }
    }), { allowInactiveTenant: true });

    expect(queryMock.mock.calls[0][0]).not.toContain("AND t.status <> 'disabled'");
    const adminAuthSource = readFileSync(resolve("src/server/admin-auth.js"), "utf8");
    expect(adminAuthSource).toContain("getSession(req, { allowInactiveTenant: true })");
  });

  it("verifies the session cookie before leaving the login form", () => {
    const formSource = readFileSync(resolve("src/components/admin-auth/AdminLoginForm.jsx"), "utf8");
    expect(formSource).toContain('fetch("/api/admin/me"');
    expect(formSource).toContain('window.location.replace(data.redirectUrl || "/admin")');
  });
});
