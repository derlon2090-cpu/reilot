import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function sources() {
  const [app, publicApp, styles, publicStyles] = await Promise.all([
    readFile("src/app/app.js", "utf8"),
    readFile("public/app/app.js", "utf8"),
    readFile("src/styles/globals.css", "utf8"),
    readFile("public/app/styles/globals.css", "utf8")
  ]);
  return { app, publicApp, styles, publicStyles };
}

describe("public page cleanup and pricing comparison", () => {
  it("keeps source and published assets identical", async () => {
    const { app, publicApp, styles, publicStyles } = await sources();
    expect(publicApp).toBe(app);
    expect(publicStyles).toBe(styles);
  });

  it("removes the duplicated blog newsletter and all eight resource-page action banners", async () => {
    const { app } = await sources();
    const blog = app.slice(app.indexOf("function blogPage()"), app.indexOf("function blogCard("));
    const resources = app.slice(app.indexOf("function marketingResourcePage()"), app.indexOf("function normalizeFooterSearch("));
    expect(blog).not.toContain("blog-v3-newsletter");
    expect(blog).not.toContain("ابقَ على اطلاع دائم");
    expect(resources).not.toContain("actionBanner");
    expect(resources).not.toContain("fp-action-banner");
    expect(resources).toContain('const pages = {"/product-updates":updatesPage,"/partners":partnersPage,"/user-guide":guidePage,"/faq":faqPage,"/integrations":integrationsPage,"/message-templates":templatesPage,"/careers":careersPage,"/contact":contactPage}');
  });

  it("renders an accessible semantic plan comparison backed by the real public catalog", async () => {
    const { app } = await sources();
    const comparison = app.slice(app.indexOf("function pricingComparisonSection()"), app.indexOf("function marketingPricingPage()"));
    const pricing = app.slice(app.indexOf("function marketingPricingPage()"), app.indexOf("function blogPage()"));
    expect(comparison).toContain('new Map((Array.isArray(state.publicPlans?.plans)');
    expect(comparison).toContain('<table class="pricing-comparison-table">');
    expect(comparison).toContain('<caption class="sr-only">');
    expect(comparison).toContain('scope="col"');
    expect(comparison).toContain('scope="row"');
    expect(comparison).toContain('dir="ltr"');
    expect(comparison).toContain('dashboardIcon(available ? "check" : "close")');
    expect(comparison).toContain('aria-label="${available ? "متاح" : "غير متاح"}"');
    expect(comparison).toContain('slug === "enterprise" ? "غير محدود" : "حسب الاتفاق"');
    expect(comparison).toContain("اختر الباقة الأنسب لنمو أعمالك");
    expect(comparison).toContain("مقارنة واضحة بين خطط Renvix لاختيار الأنسب لأعمالك");
    expect(pricing.indexOf("pricingComparisonSection()")).toBeGreaterThan(pricing.indexOf("pricing-trial-footnote"));
    expect(app).toContain('app.querySelector(".marketing-v3, .pricing-reference-page")');
  });

  it("contains the approved responsive table behavior without page-level overflow", async () => {
    const { styles } = await sources();
    const comparisonStyles = styles.slice(styles.indexOf("/* Pricing comparison:"));
    expect(comparisonStyles).toContain(".pricing-reference-page{overflow-x:clip}");
    expect(comparisonStyles).toContain(".pricing-comparison-scroll{width:100%;max-width:100%;overflow-x:auto");
    expect(comparisonStyles).toContain(".comparison-feature-column{width:25%}");
    expect(comparisonStyles).toContain(".comparison-plan-column{width:18.75%}");
    expect(comparisonStyles).toContain("@media (max-width:1199px)");
    expect(comparisonStyles).toContain("width:900px;min-width:900px");
    expect(comparisonStyles).toContain("position:sticky");
    expect(comparisonStyles).toContain("inset-inline-start:0");
    expect(comparisonStyles).toContain("@media (prefers-reduced-motion:reduce)");
  });
});
