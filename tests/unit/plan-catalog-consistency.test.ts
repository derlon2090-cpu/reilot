import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { derivePlanFeatures, getActivePlanCatalog, normalizeCatalogPlan, PAID_PLAN_SLUGS } from "../../src/server/plan-catalog.js";

const basePlan = {
  id: "plan-1",
  slug: "starter",
  name: "Starter",
  descriptionAr: "للبدء وإدارة الاشتراكات الأساسية",
  monthlyPriceSar: 25,
  yearlyPriceSar: 250,
  emailMessageLimit: 500,
  whatsappChannelsLimit: 1,
  customersLimit: 20,
  usersLimit: 2,
  storageLimitMb: 100,
  orderLinksLimit: 100,
  campaignsEnabled: false,
  automationEnabled: false,
  customApiEnabled: true,
  sallaEnabled: true,
  popular: false,
  contactSales: false,
  customPricing: false,
  displayOrder: 1
};

describe("central paid plan catalog", () => {
  it("contains only the four commercial plan slugs and never Free", () => {
    expect(PAID_PLAN_SLUGS).toEqual(["starter", "professional", "business", "enterprise"]);
    expect(PAID_PLAN_SLUGS).not.toContain("free");
    expect(PAID_PLAN_SLUGS).not.toContain("trial");
  });

  it("derives card features from the same plan fields", () => {
    const before = derivePlanFeatures(basePlan);
    const after = derivePlanFeatures({ ...basePlan, emailMessageLimit: 900, storageLimitMb: 2048 });
    expect(before.join(" ")).toContain((500).toLocaleString("ar-SA"));
    expect(after.join(" ")).toContain((900).toLocaleString("ar-SA"));
    expect(after.join(" ")).toContain(`${(2).toLocaleString("ar-SA")} GB`);
    expect(after).not.toEqual(before);
  });

  it("returns normalized records from the shared query without UI fallbacks", async () => {
    const runner = { query: vi.fn().mockResolvedValue({ rows: [basePlan] }) };
    const plans = await getActivePlanCatalog(runner);
    expect(plans).toEqual([normalizeCatalogPlan(basePlan)]);
    expect(runner.query).toHaveBeenCalledOnce();
  });

  it("feeds public pricing and user billing from the same catalog service", async () => {
    const [publicRoute, billingServer, app, publicData] = await Promise.all([
      readFile("app/api/public/plans/route.js", "utf8"),
      readFile("src/server/billing-overview.js", "utf8"),
      readFile("src/app/app.js", "utf8"),
      readFile("src/data/publicData.js", "utf8")
    ]);
    expect(publicRoute).toContain("getActivePlanCatalog");
    expect(billingServer).toContain("getActivePlanCatalog()");
    expect(app).toContain('"/api/public/plans"');
    expect(publicData).not.toContain("pricingPlans");
    expect(app).not.toContain('id: "free"');
  });

  it("keeps the new prices, storage limits, and responsive pricing reference explicit", async () => {
    const [migration, app, styles] = await Promise.all([
      readFile("drizzle/0066_commercial_plan_prices_and_limits.sql", "utf8"),
      readFile("src/app/app.js", "utf8"),
      readFile("src/styles/globals.css", "utf8")
    ]);
    expect(migration).toContain("WHEN 'starter' THEN 30");
    expect(migration).toContain("WHEN 'professional' THEN 79");
    expect(migration).toContain("WHEN 'business' THEN 189");
    expect(migration).toContain("WHEN 'business' THEN 5120");
    expect(migration).toContain("'enterprise','database_storage_bytes',true,-1::bigint");
    expect(app).not.toContain('class="whatsapp-usage-note"');
    const pricingPage = app.slice(app.indexOf("function marketingPricingPage()"), app.indexOf("function blogPage()"));
    expect(pricingPage).toContain('class="pricing-trial-footnote"');
    expect(pricingPage.indexOf('class="pricing-trial-footnote"')).toBeGreaterThan(pricingPage.indexOf('class="pricing-public-grid"'));
    expect(pricingPage).toContain("ابدأ بتجربة مجانية لمدة 7 أيام");
    expect(pricingPage).toContain("جرّب Renvix قبل اختيار باقتك. لا توجد باقة مجانية دائمة.");
    expect(pricingPage).not.toContain("شحن رصيد البريد");
    expect(pricingPage).not.toContain("emailTopup");
    expect(styles).toContain("@media (min-width:744px)");
    expect(styles).toContain("grid-template-columns:repeat(4,minmax(0,1fr))");
    expect(styles).toContain("@media (max-width:640px)");
  });

  it("provisions signup as a seven-day trial rather than a Free subscription", async () => {
    const registration = await readFile("src/server/email-otp-v2.js", "utf8");
    expect(registration).toContain("interval '7 days'");
    expect(registration).toContain("'trial'");
    expect(registration).not.toContain("slug IN ('free','trial','starter')");
  });
});
