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

  it("mirrors the support heading and columns while preserving RTL content", () => {
    expect(styles).toContain(".support-page-heading{display:flex;align-items:center;justify-content:space-between;gap:18px;direction:ltr}");
    expect(styles).toContain(".support-page-heading>*{direction:rtl}");
    expect(styles).toContain(".support-main-grid{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(360px,.88fr);gap:18px;align-items:start;direction:ltr}");
    expect(styles).toContain(".support-main-grid>*{direction:rtl}");
  });
});
