import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourceApp = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const sourceStyles = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const darkStyles = readFileSync(new URL("../../src/styles/dark-system.css", import.meta.url), "utf8");
const rootLayout = readFileSync(new URL("../../app/layout.jsx", import.meta.url), "utf8");
const staticIndex = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

describe("current pricing catalog renderer", () => {
  it("uses the current card structure while the live plans load", () => {
    expect(sourceApp).toContain("function pricingCardsLoading()");
    expect(sourceApp).toContain('class="card pricing-card pricing-card-loading"');
    expect(sourceApp).toContain("if (state.publicPlans === null) return pricingCardsLoading();");
    expect(sourceApp).not.toContain("pricing-catalog-loading");
  });

  it("removes the old loading interface from light and dark styles", () => {
    expect(sourceStyles).not.toContain(".pricing-catalog-loading");
    expect(darkStyles).not.toContain(".pricing-catalog-loading");
    expect(sourceStyles).toContain(".pricing-card-loading");
    expect(sourceStyles).toContain(".pricing-card-loading{overflow:hidden;pointer-events:none;animation:none!important}");
    expect(sourceStyles).toContain("@keyframes pricingSkeletonSweep");
  });

  it("busts both Next and static caches with the same current pricing version", () => {
    for (const markup of [rootLayout, staticIndex]) {
      expect(markup).toContain("globals.css?v=20260811-auth-independent-v80");
      expect(markup).toContain("app.js?v=20260811-auth-independent-v80");
    }
  });
});
