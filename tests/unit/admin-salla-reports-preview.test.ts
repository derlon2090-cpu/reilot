import fs from "node:fs";
import { describe, expect, it } from "vitest";

const catalogSource = fs.readFileSync("src/components/admin/AdminSallaCatalog.jsx", "utf8");
const reportsSource = fs.readFileSync("src/components/admin/AdminSallaReportsPreview.jsx", "utf8");
const integrationsSource = fs.readFileSync("src/components/admin/AdminSections.jsx", "utf8");
const userAppSource = fs.readFileSync("src/app/app.js", "utf8");
const adminStylesSource = fs.readFileSync("src/components/admin/AdminPortal.module.css", "utf8");
const globalStylesSource = fs.readFileSync("src/styles/globals.css", "utf8");

describe("Salla admin user-experience preview", () => {
  it("keeps Salla pages inside the normal dashboard without a redundant local bar", () => {
    expect(catalogSource).not.toContain("AdminSallaWorkspaceNav");
    expect(reportsSource).not.toContain("AdminSallaWorkspaceNav");
    expect(userAppSource).not.toContain("function sallaWorkspaceNav");
    expect(userAppSource).toContain("const shell = (content) => dashboardShell(content);");
  });

  it("exposes both Salla actions from the admin integrations catalog", () => {
    expect(integrationsSource).toContain('href="/admin/integrations/salla"');
    expect(integrationsSource).toContain('href="/admin/integrations/salla/reports"');
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
});
