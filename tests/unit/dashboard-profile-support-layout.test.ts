import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");

describe("dashboard profile and support layout", () => {
  it("reuses the verified profile during refresh without rendering a generic user name", () => {
    expect(appSource).toContain('const dashboardProfileCacheKey = "renvix.dashboard.profile"');
    expect(appSource).toContain("state.cachedDashboardProfile = readCachedDashboardProfile()");
    expect(appSource).toContain('target === "dashboardOverview" && payload.profile');
    expect(appSource).toContain("profile-name-skeleton");
    expect(appSource).not.toContain('profile.name || (state.language === "ar" ? "المستخدم" : "User")');
  });

  it("clears the cached identity when authentication changes", () => {
    expect(appSource.match(/clearCachedDashboardProfile\(\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps page headings on the RTL edge while preserving the requested column order", () => {
    expect(styles).toContain(".capi-page-head{width:100%;display:grid;justify-items:start;gap:8px;direction:rtl;text-align:right}");
    expect(styles).toContain(".capi-breadcrumbs{width:100%;display:flex;align-items:center;justify-content:flex-start;gap:8px;color:#8492a8;font-size:12px;direction:rtl}");
    expect(styles).toContain(".capi-title-row{width:100%;display:flex;align-items:flex-start;justify-content:flex-start;gap:12px;text-align:right;direction:rtl}");
    expect(styles).toContain(".order-links-page-title");
    expect(styles).toContain(".support-page-heading{display:flex;align-items:center;justify-content:space-between;gap:18px;direction:rtl}");
    expect(styles).toContain(".support-page-heading>*{direction:rtl}");
    expect(styles).toContain(".support-main-grid{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(360px,.88fr);gap:18px;align-items:start;direction:ltr}");
    expect(styles).toContain(".support-main-grid>*{direction:rtl}");
  });

  it("opens support conversations without a render loop and exposes professional ticket controls", () => {
    expect(appSource).toContain('target === "supportTicket"');
    expect(appSource).toContain("state.supportTicket = payload.item || null");
    expect(appSource).toContain('data-action="support-close"');
    expect(appSource).toContain('/api/support/tickets/${encodeURIComponent(id)}/close');
    expect(appSource).toContain('class="rvx-ticket-tr rvx-ticket-th"');
    expect(appSource).toContain('class="rvx-ticket-tr" data-action="support-open"');
    expect(appSource).toContain("رقم التذكرة");
    expect(styles).toContain(".rvx-ticket-tr:not(.rvx-ticket-th):hover");
    expect(styles).toContain(".rvx-ticket-th");
  });

  it("uses a full-width iPad workspace and card-based mobile ticket rows", () => {
    expect(styles).toContain("Renvix Center + Intelligence responsive hardening");
    expect(styles).toContain("@media (max-width: 1365px)");
    expect(styles).toContain(".dashboard-shell:has(.rvx-support-suite)");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) !important");
    expect(styles).toContain(".dashboard-shell:has(.rvx-support-suite) .mobile-side-toggle");
    expect(styles).toContain("@media (min-width: 701px) and (max-width: 900px)");
    expect(styles).toContain(".rvx-ticket-tr:not(.rvx-ticket-th)");
    expect(styles).toContain('"number status"');
    expect(styles).toContain("overflow-x: clip");
  });
});
