import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/password-reset.js", () => ({ resetPassword: vi.fn() }));

import { POST } from "../../app/api/auth/reset-password/route.js";
import { resetPassword } from "../../src/server/password-reset.js";

function resetRequest(password = "StrongPassword!123") {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@example.com", code: "123456", password, turnstileToken: "1x00000000000000000000AA" })
  });
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.mocked(resetPassword).mockReset();
    process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
    process.env.AUTH_URL = "https://accounts.renvix.app";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, hostname: "accounts.renvix.app", action: "reset_password" }), { headers: { "Content-Type": "application/json" } })));
  });
  afterEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
    vi.unstubAllGlobals();
  });

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
