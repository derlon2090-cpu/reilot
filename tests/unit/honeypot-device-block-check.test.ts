import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const evaluateSecurityBlockRequest = vi.hoisted(() => vi.fn(async () => ({
  referenceId: "SEC-DEVICE-1", targetType: "device", honeypotDeviceId: `hpd_${"a".repeat(32)}`
})));
const recordBlockedHoneypotNavigation = vi.hoisted(() => vi.fn(async () => ({ recorded: true })));

vi.mock("../../src/server/security-center.js", () => ({ evaluateSecurityBlockRequest, recordBlockedHoneypotNavigation }));

import { POST } from "../../app/api/security/block-check/route.js";

describe("honeypot device block decision authentication", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    evaluateSecurityBlockRequest.mockClear();
    recordBlockedHoneypotNavigation.mockClear();
  });

  it("accepts the independent honeypot HMAC secret and evaluates the signed device ID", async () => {
    const secret = "h".repeat(40);
    vi.stubEnv("SECURITY_BLOCK_CHECK_SECRET", "");
    vi.stubEnv("HONEYPOT_INGESTION_SECRET", secret);
    const body = JSON.stringify({ honeypotDeviceId: `hpd_${"a".repeat(32)}` });
    const timestamp = Date.now().toString();
    const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const response = await POST(new Request("https://renvix.app/api/security/block-check", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-security-timestamp": timestamp,
        "x-security-signature": signature
      },
      body
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, blocked: true, referenceId: "SEC-DEVICE-1" });
    expect(evaluateSecurityBlockRequest).toHaveBeenCalledWith({
      sourceIp: undefined, sessionHashes: undefined, deviceToken: undefined,
      honeypotDeviceId: `hpd_${"a".repeat(32)}`, honeypotDeviceToken: undefined
    });
  });

  it("records a blocked Renvix path for the signed honeypot identity", async () => {
    const secret = "s".repeat(40);
    vi.stubEnv("SECURITY_BLOCK_CHECK_SECRET", secret);
    const body = JSON.stringify({
      sourceIp: "203.0.113.8",
      honeypotDeviceToken: "signed-marker",
      requestedHost: "renvix.app",
      requestedPath: "/pricing",
      method: "GET",
      referrer: "https://renvix.app/"
    });
    const timestamp = Date.now().toString();
    const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const response = await POST(new Request("https://api.renvix.app/api/security/block-check", {
      method: "POST",
      headers: { "x-security-timestamp": timestamp, "x-security-signature": signature },
      body
    }));
    expect(response.status).toBe(200);
    expect(recordBlockedHoneypotNavigation).toHaveBeenCalledWith(expect.objectContaining({
      requestedHost: "renvix.app", requestedPath: "/pricing", method: "GET",
      honeypotDeviceId: `hpd_${"a".repeat(32)}`
    }));
  });

  it("rejects an unsigned device decision request before database evaluation", async () => {
    vi.stubEnv("HONEYPOT_INGESTION_SECRET", "h".repeat(40));
    const response = await POST(new Request("https://renvix.app/api/security/block-check", {
      method: "POST", body: JSON.stringify({ honeypotDeviceId: `hpd_${"b".repeat(32)}` })
    }));
    expect(response.status).toBe(401);
    expect(evaluateSecurityBlockRequest).not.toHaveBeenCalled();
  });
});
