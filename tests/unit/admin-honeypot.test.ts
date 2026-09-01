import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { adminHoneypotEvent, recordAdminHoneypotRequest } from "../../src/shared/admin-honeypot.js";

function request() {
  return {
    method: "POST",
    url: "https://admin.renvix.app/.env?token=must-not-leak",
    nextUrl: new URL("https://admin.renvix.app/.env?token=must-not-leak"),
    headers: new Headers({
      authorization: "Bearer must-not-leak",
      cookie: "renvix_admin_session=must-not-leak",
      "x-real-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.50",
      "x-vercel-ip-country": "SA",
      "x-vercel-ip-country-region": "Riyadh",
      "x-vercel-ip-city": "Riyadh",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0",
      referer: "https://example.test/page?secret=must-not-leak",
      "x-vercel-id": "request-1"
    })
  };
}

describe("Vercel admin honeypot fallback", () => {
  it("sanitizes and signs the event for the existing security ingestion boundary", async () => {
    const event = adminHoneypotEvent(request());
    expect(event.source_ip).toBe("203.0.113.10");
    expect(event.requested_path).toBe("/.env");
    expect(event.referrer).toBe("https://example.test/page");
    expect(JSON.stringify(event)).not.toContain("must-not-leak");
    expect(JSON.stringify(event)).not.toContain("198.51.100.50");

    const fetcher = vi.fn(async (_target: URL, _init: RequestInit) => new Response(null, { status: 200 }));
    const secret = "a-long-independent-honeypot-secret";
    await expect(recordAdminHoneypotRequest(request(), {
      NODE_ENV: "production",
      API_PUBLIC_URL: "https://api.renvix.app",
      HONEYPOT_INGESTION_SECRET: secret
    }, fetcher)).resolves.toEqual({ ok: true });

    const [target, init] = fetcher.mock.calls[0];
    expect(String(target)).toBe("https://api.renvix.app/api/security/ingest/honeypot");
    const headers = new Headers(init.headers);
    const body = String(init.body);
    const timestamp = headers.get("X-Renvix-Timestamp");
    const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    expect(headers.get("X-Renvix-Signature")).toBe(expected);
    expect(body).not.toContain("must-not-leak");
  });

  it("fails closed without a trusted source or ingestion secret", async () => {
    const fetcher = vi.fn();
    const noSource = request();
    noSource.headers.delete("x-real-ip");
    await expect(recordAdminHoneypotRequest(noSource, {}, fetcher)).resolves.toMatchObject({ ok: false });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
