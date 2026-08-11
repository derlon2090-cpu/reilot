import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const appSource = fs.readFileSync(path.join(root, "src/app/app.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "src/styles/globals.css"), "utf8");

describe("user dashboard collapsible sidebar", () => {
  it("renders a persistent desktop control in the user dashboard shell", () => {
    expect(appSource).toContain('const dashboardSidebarCollapsedKey = "renvix.dashboard.sidebar.collapsed"');
    expect(appSource).toContain('data-action="toggle-sidebar-collapse"');
    expect(appSource).toContain('dashboardIcon(state.sidebarCollapsed ? "close" : "menu")');
    expect(appSource).toContain('sidebarCollapsed: storage.get(dashboardSidebarCollapsedKey, false) === true');
    expect(appSource).toContain('storage.set(dashboardSidebarCollapsedKey, state.sidebarCollapsed)');
  });

  it("uses the Renvix mark and icon-only navigation when collapsed", () => {
    expect(appSource).toContain('/assets/renvix-mark-deep-teal.svg');
    expect(appSource).toContain('dashboard-shell ${state.sidebarCollapsed ? "sidebar-collapsed" : ""}');
    expect(stylesSource).toContain(".dashboard-shell.sidebar-collapsed { grid-template-columns: 82px minmax(0, 1fr) !important; }");
    expect(stylesSource).toContain(".dashboard-shell.sidebar-collapsed .side-link span");
    expect(stylesSource).toContain(".dashboard-shell.sidebar-collapsed .sidebar-support-link span");
  });

  it("moves the desktop search left without changing the mobile drawer", () => {
    expect(stylesSource).toContain(".topbar .dashboard-search { transform: translateX(-22px)");
    expect(stylesSource).toContain("@media (max-width: 980px)");
    expect(stylesSource).toContain(".dashboard-sidebar-toggle { display: none; }");
    expect(stylesSource).toContain(".topbar .dashboard-search { transform: none; }");
    expect(appSource).toContain('class="sidebar-backdrop" data-action="close-sidebar"');
  });
});
