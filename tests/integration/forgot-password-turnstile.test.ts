import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/password-reset.js", () => ({ requestPasswordReset: vi.fn() }));

import { POST } from "../../app/api/auth/forgot-password/route.js";
import { requestPasswordReset } from "../../src/server/password-reset.js";

describe("POST /api/auth/forgot-password Turnstile", () => {
  beforeEach(() => {
    vi.mocked(requestPasswordReset).mockReset();
    process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
    process.env.AUTH_URL = "https://accounts.renvix.app";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, hostname: "accounts.renvix.app", action: "forgot_password" }), { headers: { "Content-Type": "application/json" } })));
  });

  afterEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
    vi.unstubAllGlobals();
  });

  it("verifies the challenge before requesting a reset", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ ok: true, status: 200, message: "If the address exists, instructions will be sent." });
    const response = await POST(new Request("https://accounts.renvix.app/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com", locale: "en", turnstileToken: "1x00000000000000000000AA" })
    }));
    expect(response.status).toBe(200);
    expect(requestPasswordReset).toHaveBeenCalledOnce();
  });

  it("does not disclose or process an address when the challenge is missing", async () => {
    const response = await POST(new Request("https://accounts.renvix.app/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com", locale: "en" })
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, reason: "turnstile_failed" });
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });
});
