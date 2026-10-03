import fs from "node:fs";
import { describe, expect, it } from "vitest";

const portalSource = fs.readFileSync("src/components/admin/AdminPortal.jsx", "utf8");
const stylesSource = fs.readFileSync("src/components/admin/AdminPortal.module.css", "utf8");

describe("admin sidebar collapse contract", () => {
  it("starts expanded and persists the administrator choice", () => {
    expect(portalSource).toContain("useState(false)");
    expect(portalSource).toContain('localStorage.getItem("renvix.admin.sidebar.collapsed")');
    expect(portalSource).toContain('localStorage.setItem("renvix.admin.sidebar.collapsed", String(next))');
  });

  it("keeps the official Renvix mark in both expanded and compact modes", () => {
    expect(portalSource).toContain('src="/assets/renvix-logo-official.svg"');
    expect(portalSource).toContain('name={sidebarCollapsed ? "close" : "menu"}');
    expect(portalSource).toContain('aria-expanded={!sidebarCollapsed}');
  });

  it("keeps accessible section labels while showing icons only", () => {
    expect(portalSource).toContain("aria-label={label}");
    expect(portalSource).toContain("title={sidebarCollapsed ? label : undefined}");
    expect(stylesSource).toMatch(/\.dashboardCollapsed\s*\{\s*grid-template-columns:\s*78px/);
    expect(stylesSource).toContain(".dashboardCollapsed .sidebar nav button span { display: none; }");
  });

  it("moves the search slightly left and preserves the single-column mobile layout", () => {
    expect(stylesSource).toContain(".topbarCenter { transform: translateX(-24px)");
    expect(stylesSource).toMatch(/@media \(max-width: 820px\)[\s\S]*?\.dashboardCollapsed \{ grid-template-columns: 1fr; \}/);
  });
});
