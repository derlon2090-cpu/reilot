import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");

describe("dashboard notification dropdown", () => {
  it("updates only the notification chrome instead of rerendering the dashboard", () => {
    const handlerStart = appSource.indexOf('if (action === "notifications")');
    const handlerEnd = appSource.indexOf('if (action === "notification-mark-all")', handlerStart);
    const handler = appSource.slice(handlerStart, handlerEnd);

    expect(handler).toContain("refreshNotificationDropdownChrome()");
    expect(handler).not.toContain("render()");
  });

  it("keeps the lightweight dropdown accessible and dismissible", () => {
    expect(appSource).toContain('aria-controls="dashboard-notification-dropdown"');
    expect(appSource).toContain('aria-expanded="${state.notificationDropdownOpen ? "true" : "false"}"');
    expect(appSource).toContain('!event.target.closest(".notification-trigger-wrap")');
    expect(appSource).toContain('event.key === "Escape" && state.notificationDropdownOpen');
  });

  it("keeps the desktop user navigation attached while preserving active-item motion", () => {
    const refinedNavigation = stylesSource.slice(stylesSource.indexOf("/* Refined user dashboard navigation */"));

    expect(refinedNavigation).toContain("position: sticky;");
    expect(refinedNavigation).toContain("inset-block-start: 0;");
    expect(refinedNavigation).toContain("height: 100dvh;");
    expect(refinedNavigation).toContain("margin: 0;");
    expect(refinedNavigation).toContain("transition: color .18s ease");
  });
});
