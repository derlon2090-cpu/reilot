import { afterEach, describe, expect, it, vi } from "vitest";
import { TURNSTILE_ACTIONS, verifyTurnstileToken } from "../../src/server/turnstile.js";

const testEnv = {
  NODE_ENV: "test",
  AUTH_URL: "https://accounts.renvix.app",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA"
};

function request() {
  return new Request("https://accounts.renvix.app/api/auth/login", {
    headers: { "cf-connecting-ip": "203.0.113.10" }
  });
}

function siteverify(payload: Record<string, unknown>, status = 200) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  }));
}

describe("Cloudflare Turnstile server verification", () => {
  afterEach(() => vi.restoreAllMocks());

  it("accepts a successful challenge only for the expected hostname and action", async () => {
    const fetchImpl = siteverify({ success: true, hostname: "accounts.renvix.app", action: "login" });
    const result = await verifyTurnstileToken({
      token: "1x00000000000000000000AA",
      expectedAction: TURNSTILE_ACTIONS.login,
      request: request(),
      env: testEnv,
      fetchImpl
    });

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, options] = fetchImpl.mock.calls[0];
    expect(options.body).toContain("remoteip=203.0.113.10");
    expect(options.body).toContain("response=1x00000000000000000000AA");
  });

  it.each([
    ["missing token", "", { success: true, hostname: "accounts.renvix.app", action: "login" }, "missing_token"],
    ["invalid token", "bad", { success: false, "error-codes": ["invalid-input-response"] }, "challenge_failed"],
    ["expired or reused token", "used", { success: false, "error-codes": ["timeout-or-duplicate"] }, "challenge_failed"],
    ["wrong action", "valid", { success: true, hostname: "accounts.renvix.app", action: "register" }, "action_mismatch"],
    ["wrong hostname", "valid", { success: true, hostname: "renvix.app", action: "login" }, "hostname_mismatch"]
  ])("rejects %s", async (_name, token, payload, reason) => {
    const result = await verifyTurnstileToken({
      token,
      expectedAction: TURNSTILE_ACTIONS.login,
      request: request(),
      env: testEnv,
      fetchImpl: siteverify(payload)
    });
    expect(result).toEqual({ ok: false, reason });
  });

  it("fails closed in production when the server secret is missing", async () => {
    await expect(verifyTurnstileToken({
      token: "token",
      expectedAction: TURNSTILE_ACTIONS.login,
      request: request(),
      env: { NODE_ENV: "production", AUTH_URL: "https://accounts.renvix.app" },
      fetchImpl: siteverify({})
    })).resolves.toEqual({ ok: false, reason: "configuration_error" });
  });
});
