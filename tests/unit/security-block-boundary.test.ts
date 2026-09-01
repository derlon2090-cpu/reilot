import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSecurityBlockAtBoundary, neutralSecurityBlockResponse } from "../../src/shared/security-block-boundary.js";

function request(cookies: Record<string, string> = {}) {
  return {
    url: "https://dash.renvix.app/dashboard",
    headers: new Headers({ "cf-connecting-ip": "203.0.113.8" }),
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

  it("sends only hashes of session cookies to the internal decision endpoint", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.sessionHashes).toHaveLength(1);
      expect(body.sessionHashes[0]).toMatch(/^[a-f0-9]{64}$/);
      expect(String(init.body)).not.toContain("raw-session-token");
      expect(new Headers(init.headers).get("x-security-signature")).toMatch(/^[a-f0-9]{64}$/);
      return new Response(JSON.stringify({ ok: true, blocked: true, referenceId: "SEC-8F21A7" }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await checkSecurityBlockAtBoundary(request({ renewpilot_session: "raw-session-token" }), {
      SECURITY_BLOCK_CHECK_SECRET: "x".repeat(32),
      SECURITY_BLOCK_CHECK_URL: "https://api.renvix.app/api/security/block-check"
    });
    expect(result).toEqual({ blocked: true, referenceId: "SEC-8F21A7" });
  });

  it("returns a neutral 403 without disclosing the block reason", async () => {
    const response = neutralSecurityBlockResponse("SEC-8F21A7", false);
    const html = await response.text();
    expect(response.status).toBe(403);
    expect(html).toContain("تعذر الوصول إلى هذه الصفحة حاليًا");
    expect(html).toContain("SEC-8F21A7");
    expect(html).not.toMatch(/نشاط مريب|حظر الجهاز|عنوان IP/);
  });
});
