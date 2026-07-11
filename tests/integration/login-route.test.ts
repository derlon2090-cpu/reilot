import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/auth-actions.js", () => ({ loginAccount: vi.fn() }));

import { POST } from "../../app/api/auth/login/route.js";
import { loginAccount } from "../../src/server/auth-actions.js";

function loginRequest(password: string) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@example.com", password })
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => vi.mocked(loginAccount).mockReset());

  it("returns 401 without creating a cookie when credentials are invalid", async () => {
    vi.mocked(loginAccount).mockResolvedValue({ ok: false, status: 401, reason: "invalid_credentials" });
    const response = await POST(loginRequest("Wrong@999"));

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("sets an HttpOnly cookie only after credential verification succeeds", async () => {
    vi.mocked(loginAccount).mockResolvedValue({
      ok: true,
      status: 200,
      user: { id: "user-1", email: "owner@example.com" },
      session: { token: "raw-session-token" }
    });
    const response = await POST(loginRequest("Test@12345"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("renewpilot_session=");
    expect(JSON.stringify(body)).not.toContain("raw-session-token");
  });
});
