import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";

describe("staging application asset cache", () => {
  it("prevents the browser from reusing stale app assets", async () => {
    const rules = await nextConfig.headers();
    const appRule = rules.find((rule) => rule.source === "/app/:path*");
    const cacheControl = appRule?.headers.find((header) => header.key === "Cache-Control");

    expect(cacheControl?.value).toContain("no-store");
  });
});
