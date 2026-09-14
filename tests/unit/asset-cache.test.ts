import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";

describe("staging application asset cache", () => {
  it("suppresses framework fingerprinting and defines baseline response headers", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);

    const rules = await nextConfig.headers();
    const globalRule = rules.find((rule) => rule.source === "/:path*");
    const headers = Object.fromEntries(globalRule?.headers.map((header) => [header.key, header.value]) || []);
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
  });

  it("prevents the browser from reusing stale app assets", async () => {
    const rules = await nextConfig.headers();
    const appRule = rules.find((rule) => rule.source === "/app/:path*");
    const cacheControl = appRule?.headers.find((header) => header.key === "Cache-Control");

    expect(cacheControl?.value).toContain("no-store");
  });
});
