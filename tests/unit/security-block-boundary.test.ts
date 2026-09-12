import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSecurityBlockAtBoundary, neutralSecurityBlockResponse } from "../../src/shared/security-block-boundary.js";

function request(cookies: Record<string, string> = {}) {
  return {
    url: "https://dash.renvix.app/dashboard",
    method: "GET",
    headers: new Headers({ "cf-connecting-ip": "203.0.113.8", referer: "https://renvix.app/plans?secret=drop" }),
    cookies: { get: (name: string) => cookies[name] ? { value: cookies[name] } : undefined }
  } as never;
}

describe("central security block boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails open when the dedicated internal HMAC secret is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(checkSecurityBlockAtBoundary(request(), {})).resolves.toEqual({ blocked: false, enforcement: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only hashes and the signed containment marker to the internal decision endpoint", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.sessionHashes).toHaveLength(1);
      expect(body.sessionHashes[0]).toMatch(/^[a-f0-9]{64}$/);
      expect(body.honeypotDeviceToken).toBe("signed-honeypot-marker");
      expect(body).toMatchObject({
        requestedHost: "dash.renvix.app",
        requestedPath: "/dashboard",
        method: "GET",
        referrer: "https://renvix.app/plans"
      });
      expect(String(init.body)).not.toContain("raw-session-token");
      expect(new Headers(init.headers).get("x-security-signature")).toMatch(/^[a-f0-9]{64}$/);
      return new Response(JSON.stringify({ ok: true, blocked: true, referenceId: "SEC-8F21A7" }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await checkSecurityBlockAtBoundary(request({
      renewpilot_session: "raw-session-token",
      renvix_honeypot_device: "signed-honeypot-marker"
    }), {
      SECURITY_BLOCK_CHECK_SECRET: "x".repeat(32),
      SECURITY_BLOCK_CHECK_URL: "https://api.renvix.app/api/security/block-check"
    });
    expect(result).toEqual({ blocked: true, referenceId: "SEC-8F21A7" });
  });

  it("returns a professional 403 with a support-review reference", async () => {
    const response = neutralSecurityBlockResponse("SEC-8F21A7", false);
    const html = await response.text();
    expect(response.status).toBe(403);
    expect(html).toContain("تم حظر الوصول");
    expect(html).toContain("مراجعة الحظر مع الدعم");
    expect(html).toContain("SEC-8F21A7");
    expect(html).not.toMatch(/نشاط مريب|عنوان IP/);
  });
});
