import { afterEach, describe, expect, it } from "vitest";
import { sameOriginRequest } from "../../src/server/campaign-contacts.js";

const originalTrustedOrigins = process.env.TRUSTED_APP_ORIGINS;

afterEach(() => {
  if (originalTrustedOrigins === undefined) delete process.env.TRUSTED_APP_ORIGINS;
  else process.env.TRUSTED_APP_ORIGINS = originalTrustedOrigins;
});

function request(origin?: string, extraHeaders: Record<string, string> = {}) {
  const headers = new Headers(extraHeaders);
  if (origin) headers.set("origin", origin);
  return new Request("https://api.renvix.app/api/ai/messages", { method: "POST", headers });
}

describe("sameOriginRequest", () => {
  it("accepts server requests without an Origin header", () => {
    expect(sameOriginRequest(request())).toBe(true);
  });

  it("accepts direct same-origin browser requests", () => {
    expect(sameOriginRequest(request("https://api.renvix.app"))).toBe(true);
  });

  it("accepts same-origin browser requests rewritten from Vercel to Render", () => {
    expect(sameOriginRequest(request("https://preview.example", { "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("accepts only explicitly configured frontend origins when Fetch Metadata is unavailable", () => {
    process.env.TRUSTED_APP_ORIGINS = "https://portal.example";
    expect(sameOriginRequest(request("https://portal.example"))).toBe(true);
    expect(sameOriginRequest(request("https://attacker.example", { "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("does not trust a forged forwarded host", () => {
    expect(sameOriginRequest(request("https://attacker.example", { "x-forwarded-host": "attacker.example" }))).toBe(false);
  });
});
