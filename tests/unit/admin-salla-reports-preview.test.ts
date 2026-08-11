import fs from "node:fs";
import { describe, expect, it } from "vitest";

const catalogSource = fs.readFileSync("src/components/admin/AdminSallaCatalog.jsx", "utf8");
const navSource = fs.readFileSync("src/components/admin/AdminSallaWorkspaceNav.jsx", "utf8");
const reportsSource = fs.readFileSync("src/components/admin/AdminSallaReportsPreview.jsx", "utf8");
const integrationsSource = fs.readFileSync("src/components/admin/AdminSections.jsx", "utf8");

describe("Salla admin user-experience preview", () => {
  it("keeps the Salla workspace navigation visible in templates and reports", () => {
    expect(catalogSource).toContain('<AdminSallaWorkspaceNav active="templates" />');
    expect(navSource).toContain("/admin/integrations/salla/reports");
    expect(navSource).toContain("معاينة وتحرير");
    expect(navSource).toContain("تقارير سلة");
  });

  it("exposes both Salla actions from the admin integrations catalog", () => {
    expect(integrationsSource).toContain('href="/admin/integrations/salla"');
    expect(integrationsSource).toContain('href="/admin/integrations/salla/reports"');
  });

  it("never fabricates report metrics in the administrative preview", () => {
    expect(reportsSource).toContain("لا تملك جلسة الأدمن بيانات متجر مستخدم");
    expect(reportsSource).toContain("<strong>—</strong>");
    expect(reportsSource).not.toMatch(/2,845|1,128|221,450|39\.6%/);
  });
});
