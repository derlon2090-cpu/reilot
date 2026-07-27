import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/password-reset.js", () => ({ resetPassword: vi.fn() }));

import { POST } from "../../app/api/auth/reset-password/route.js";
import { resetPassword } from "../../src/server/password-reset.js";

function resetRequest(password = "StrongPassword!123") {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@example.com", code: "123456", password })
  });
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => vi.mocked(resetPassword).mockReset());

  it("returns the exact weak-password reason instead of an invalid-session error", async () => {
    vi.mocked(resetPassword).mockResolvedValue({ ok: false, status: 400, reason: "weak_password" });
    const response = await POST(resetRequest("weak-password"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, reason: "weak_password" });
  });

  it("returns success after the reset code is consumed", async () => {
    vi.mocked(resetPassword).mockResolvedValue({ ok: true, status: 200 });
    const response = await POST(resetRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
