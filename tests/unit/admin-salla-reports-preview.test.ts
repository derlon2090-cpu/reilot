import fs from "node:fs";
import { describe, expect, it } from "vitest";

const catalogSource = fs.readFileSync("src/components/admin/AdminSallaCatalog.jsx", "utf8");
const reportsSource = fs.readFileSync("src/components/admin/AdminSallaReportsPreview.jsx", "utf8");
const integrationsSource = fs.readFileSync("src/components/admin/AdminSections.jsx", "utf8");
const userAppSource = fs.readFileSync("src/app/app.js", "utf8");
const adminStylesSource = fs.readFileSync("src/components/admin/AdminPortal.module.css", "utf8");
const globalStylesSource = fs.readFileSync("src/styles/globals.css", "utf8");
const adminPortalSource = fs.readFileSync("src/components/admin/AdminPortal.jsx", "utf8");
const catalogPageSource = fs.readFileSync("app/admin/integrations/salla/page.jsx", "utf8");
const reportsPageSource = fs.readFileSync("app/admin/integrations/salla/reports/page.jsx", "utf8");

describe("Salla admin user-experience preview", () => {
  it("keeps Salla pages inside the normal dashboard without a redundant local bar", () => {
    expect(catalogSource).not.toContain("AdminSallaWorkspaceNav");
    expect(reportsSource).not.toContain("AdminSallaWorkspaceNav");
    expect(userAppSource).not.toContain("function sallaWorkspaceNav");
    expect(userAppSource).toContain("const shell = (content) => dashboardShell(content);");
    expect(adminPortalSource).toContain("children ? children");
    expect(catalogPageSource).toContain('<AdminPortal initialAdmin={initialAdmin} initialPanel="integrations">');
    expect(reportsPageSource).toContain('<AdminPortal initialAdmin={initialAdmin} initialPanel="integrations">');
  });

  it("exposes both Salla actions from the admin integrations catalog", () => {
    expect(integrationsSource).toContain('href="/admin/integrations/salla"');
    expect(integrationsSource).toContain('href="/admin/integrations/salla/reports"');
    expect(integrationsSource.indexOf('href="/admin/integrations/salla/reports"')).toBeLessThan(integrationsSource.indexOf('href="/admin/integrations/salla"'));

    const userActions = userAppSource.match(/<div class="linked-app-actions salla-linked-primary-actions">([\s\S]*?)<\/div>/)?.[1] || "";
    expect(userActions.indexOf('data-link="/dashboard/apps/salla/reports"')).toBeLessThan(userActions.indexOf('data-link="/dashboard/apps/salla/templates"'));
  });

  it("centers the labels of both Salla integration actions", () => {
    expect(adminStylesSource).toMatch(/\.adminPlatformAppFooterActions a\s*\{[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/);
    expect(globalStylesSource).toMatch(/\.salla-linked-primary-actions \.btn\{[^}]*align-items:center;[^}]*justify-content:center;/);
  });

  it("never fabricates report metrics in the administrative preview", () => {
    expect(reportsSource).toContain("لا تملك جلسة الأدمن بيانات متجر مستخدم");
    expect(reportsSource).toContain("<strong>—</strong>");
    expect(reportsSource).not.toMatch(/2,845|1,128|221,450|39\.6%/);
  });

  it("shows real zeros and a professional empty chart for connected stores without events", () => {
    expect(userAppSource).toContain('Number(summary.abandoned || 0).toLocaleString("ar-SA")');
    expect(userAppSource).toContain('sallaReportMoney(summary.recoveredValue ?? 0)');
    expect(userAppSource).toContain('لا توجد بيانات سلات ضمن الفترة المحددة');
    expect(userAppSource).toContain('hasTimelineData ? sallaReportChart(timeline)');
    expect(userAppSource).not.toContain('!hasData ? `<section class="card salla-report-connected-empty"');
  });

  it("keeps the completed template card free of redundant delivery chips", () => {
    expect(catalogSource).not.toContain('className="salla-mode-chips"');
    expect(userAppSource).not.toContain('class="salla-mode-chips"');
    expect(globalStylesSource).not.toContain(".salla-mode-chips");
  });
});
