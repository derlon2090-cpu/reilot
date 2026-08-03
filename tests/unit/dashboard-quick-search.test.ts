import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");

describe("dashboard comprehensive quick search", () => {
  it("keeps global search isolated from page filters", () => {
    expect(appSource).toContain('globalSearch: ""');
    expect(appSource).toContain('state.globalSearch = target.value');
    expect(appSource).toContain('value="${escapeHtml(state.globalSearch)}"');
  });

  it("covers every user workspace plus direct Salla and API destinations", () => {
    const routes = [
      "/dashboard",
      "/dashboard/subscriptions",
      "/dashboard/customers",
      "/dashboard/order-links",
      "/dashboard/templates",
      "/dashboard/campaigns",
      "/dashboard/contacts",
      "/dashboard/devices",
      "/dashboard/apps",
      "/dashboard/apps/salla/templates",
      "/dashboard/settings/integrations/custom-api",
      "/dashboard/notifications",
      "/dashboard/security",
      "/dashboard/reports",
      "/dashboard/billing",
      "/dashboard/settings",
      "/dashboard/support"
    ];

    routes.forEach((route) => expect(appSource).toContain(`route: "${route}"`));
  });

  it("supports Arabic and English aliases and keyboard navigation", () => {
    [
      "اشتراكات", "تجديدات", "عملاء", "قوالب سلة", "زد", "شوبيفاي",
      "تحقق ثنائي", "فوترة", "شكاوى", "subscriptions", "customers",
      "shopify", "webhook", "security", "billing", "support"
    ].forEach((keyword) => expect(appSource).toContain(keyword));

    expect(appSource).toContain('event.key === "ArrowDown"');
    expect(appSource).toContain('event.key === "Enter" && matches[0]');
    expect(appSource).toContain('event.key === "Escape"');
  });

  it("renders an accessible floating result list without changing the input size", () => {
    expect(appSource).toContain('role="combobox"');
    expect(appSource).toContain('role="listbox"');
    expect(appSource).toContain('role="option"');
    expect(stylesSource).toContain(".dashboard-quick-search-results {");
    expect(stylesSource).toContain(".dashboard-quick-search-result {");
    expect(stylesSource).toContain(".topbar .dashboard-search { width: min(560px, 43vw); }");
  });
});
