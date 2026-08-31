import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const catalogMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/server/plan-catalog.js", () => ({
  getActivePlanCatalog: catalogMock
}));

import { GET, OPTIONS } from "../../app/api/public/plans/route.js";

const root = process.cwd();
const appSource = fs.readFileSync(path.join(root, "src/app/app.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "src/styles/globals.css"), "utf8");
const featuresPageSource = appSource.slice(
  appSource.indexOf("function marketingFeaturesPage()"),
  appSource.indexOf("function marketingPricingPage()")
);

const plan = {
  id: "plan-1",
  slug: "starter",
  name: "Starter",
  features: ["100 MB مساحة تخزين"],
  monthlyPriceSar: 30,
  yearlyPriceSar: 300
};

const originalAuthUrl = process.env.NEXT_PUBLIC_AUTH_URL;

describe("public marketing resilience", () => {
  beforeEach(() => {
    catalogMock.mockReset();
    process.env.NEXT_PUBLIC_AUTH_URL = "https://accounts.renvix.app";
  });

  afterEach(() => {
    if (originalAuthUrl === undefined) delete process.env.NEXT_PUBLIC_AUTH_URL;
    else process.env.NEXT_PUBLIC_AUTH_URL = originalAuthUrl;
  });

  it("uses the current production feature hierarchy without the retired boxed strips", () => {
    expect(featuresPageSource).toContain('class="features-production-main"');
    expect(featuresPageSource).toContain('class="features-core-grid"');
    expect(featuresPageSource).toContain('class="features-advanced-grid"');
    expect(featuresPageSource).toContain('class="features-performance-section"');
    expect(featuresPageSource).not.toContain("marketing-feature-benefits");
    expect(featuresPageSource).not.toContain("mobile-feature-benefits");
    expect(stylesSource).not.toContain(".marketing-feature-benefits");
    expect(stylesSource).not.toContain(".mobile-feature-benefits");
  });

  it("serves the real plan catalog cross-origin and falls back to its last successful snapshot", async () => {
    const request = new Request("https://api.renvix.app/api/public/plans", {
      headers: { Origin: "https://accounts.renvix.app" }
    });
    catalogMock.mockResolvedValueOnce([plan]);
    const fresh = await GET(request);
    expect(fresh.status).toBe(200);
    expect(fresh.headers.get("access-control-allow-origin")).toBe("https://accounts.renvix.app");
    expect(await fresh.json()).toMatchObject({ ok: true, plans: [plan] });

    catalogMock.mockRejectedValueOnce(Object.assign(new Error("temporary outage"), { code: "ETIMEDOUT" }));
    const stale = await GET(request);
    expect(stale.status).toBe(200);
    expect(stale.headers.get("x-renvix-catalog-cache")).toBe("stale");
    expect(await stale.json()).toMatchObject({ ok: true, cached: true, plans: [plan] });
  });

  it("allows the accounts portal to preflight the public plan request", async () => {
    const response = OPTIONS(new Request("https://api.renvix.app/api/public/plans", {
      method: "OPTIONS",
      headers: { Origin: "https://accounts.renvix.app" }
    }));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
    expect(response.headers.get("access-control-allow-origin")).toBe("https://accounts.renvix.app");
  });

  it("retries the backend route and preserves only a recently successful real catalog", () => {
    expect(appSource).toContain('const publicPlansCacheKey = "renvix.public-plans.v1"');
    expect(appSource).toContain("for (const endpoint of publicPlansEndpoints())");
    expect(appSource).toContain("for (let attempt = 0; attempt < 2; attempt += 1)");
    expect(appSource).toContain("state.publicPlans = readCachedPublicPlans()");
    expect(appSource).toContain("cachePublicPlans(payload)");
  });
});
