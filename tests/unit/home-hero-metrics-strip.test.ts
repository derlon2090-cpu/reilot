import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/app/app.js", "utf8");
const stylesSource = readFileSync("src/styles/globals.css", "utf8");
const homeSource = appSource.slice(
  appSource.indexOf("function marketingHomePage()"),
  appSource.indexOf("function marketingMobileHomeNetwork()")
);

describe("current home hero", () => {
  it("keeps a responsive two-column hero with the real dashboard preview", () => {
    expect(homeSource).toContain('class="home-hero"');
    expect(homeSource).toContain('class="container home-hero-grid"');
    expect(homeSource).toContain("homeDashboardPreview()");
    expect(stylesSource).toContain(".home-hero-grid");
    expect(stylesSource).toContain("@media (max-width:900px)");
  });

  it("shows the three concrete onboarding assurances with consistent status icons", () => {
    expect(homeSource).toContain('localizedCopy("تجربة مجانية 14 يومًا", "14-day free trial")');
    expect(homeSource).toContain('localizedCopy("لا بطاقة ائتمانية مطلوبة", "No credit card required")');
    expect(homeSource).toContain('localizedCopy("إعداد سريع خلال دقائق", "Setup in minutes")');
    expect(homeSource.match(/dashboardIcon\("check"\)/g)).toHaveLength(3);
  });

  it("keeps the primary and secondary calls to action separate", () => {
    expect(homeSource).toContain('href="/register" class="btn btn-primary"');
    expect(homeSource).toContain('href="/features" class="btn btn-secondary"');
  });
});
