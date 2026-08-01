import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/app.js"), "utf8");
const styles = fs.readFileSync(path.resolve(process.cwd(), "src/styles/globals.css"), "utf8");
const appsDataSource = fs.readFileSync(path.resolve(process.cwd(), "src/server/salla-app.js"), "utf8");

describe("applications catalog", () => {
  it("keeps linked applications visible above the full catalog", () => {
    expect(appSource).toContain("function linkedAppsSection");
    expect(appSource).toContain("التطبيقات المرتبطة");
    expect(appSource).toContain("تبقى تطبيقاتك المحفوظة ظاهرة هنا");
    expect(appSource).toContain("${linkedAppsSection(connection, customIntegrations)}");
    expect(appSource).toContain("${appsCatalogMarkup(data, connected, customIntegrations)}");
    expect(appSource).toContain("معاينة");
    expect(appSource).toContain("تحرير");
  });

  it("shows Zid and Shopify in Arabic as matching unavailable integrations", () => {
    expect(appSource).toContain("integration-card--unavailable");
    expect(appSource).toContain("غير متاح حاليًا");
    expect(appSource).toContain('aria-disabled="true"');
    expect(appSource).toContain('aria-label="شعار زد"');
    expect(appSource).toContain('aria-label="شعار شوبيفاي"');
    expect(appSource).toContain("<h2>شوبيفاي</h2>");
    expect(appSource).toContain("integration-logo--shopify");
    expect(styles).toContain(".integration-card--unavailable");
    expect(styles).toContain(".integration-logo--shopify");
    expect(styles).toContain(".integration-empty-card--full");
  });

  it("includes custom integrations in the account applications response", () => {
    expect(appsDataSource).toContain("customIntegrations");
    expect(appsDataSource).toContain("availableApps: 3");
    expect(appsDataSource).toContain("connectedCustomApps");
  });
});
