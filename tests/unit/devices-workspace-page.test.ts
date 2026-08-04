import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const repositorySource = readFileSync(new URL("../../src/server/whatsapp-repository.js", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../../app/api/whatsapp/instances/create/route.js", import.meta.url), "utf8");

describe("devices command center", () => {
  it("keeps the current route and renders the requested RTL sections", () => {
    expect(appSource).toContain('"/dashboard/devices": devicesWorkspacePage');
    for (const title of ["إجمالي الأجهزة", "الأجهزة النشطة", "أجهزة تحتاج اهتمام", "مستوى الاستقرار", "إدارة الأجهزة المتصلة", "جاهزية الربط", "معلومات مهمة", "سجل النشاط الأخير"]) {
      expect(appSource).toContain(title);
    }
    expect(appSource).toContain('class="devices-command-page"');
    expect(stylesSource).toContain(".devices-command-page{display:grid");
    expect(stylesSource).toContain("direction:rtl");
  });

  it("uses real tenant channels and the existing activity log without demo devices", () => {
    expect(repositorySource).toContain("export async function tenantChannels");
    expect(repositorySource).toContain("export async function recentDeviceActivity");
    expect(repositorySource).toContain("FROM whatsapp_channels");
    expect(repositorySource).toContain("FROM activity_logs");
    expect(routeSource).toContain("tenantChannels(auth.session.tenantId)");
    expect(routeSource).toContain("recentDeviceActivity(auth.session.tenantId)");
    for (const fakeName of ["iPhone 14 Pro", "Windows Workstation", "MacBook Air M2", "Galaxy S24 Ultra", "iPad Pro"]) {
      expect(appSource).not.toContain(fakeName);
    }
  });

  it("keeps all required actions wired to real handlers", () => {
    for (const action of ["connect-meta-whatsapp", "device-sync-all", "device-connection-test", "device-search", "device-status-filter", "device-details", "device-resync", "device-activity-toggle"]) {
      expect(appSource).toContain(`data-action="${action}"`);
    }
    expect(appSource).toContain("refreshLinkedDevice");
    expect(appSource).toContain('["meta", "meta_cloud", "meta_cloud_api"].includes(provider)');
    expect(appSource).not.toContain("/api/whatsapp/instances/${encodeURIComponent(device.id)}/check");
  });

  it("keeps overview cards clean without colored edge strips", () => {
    const cardRule = stylesSource.match(/\.devices-overview-card\{[^}]+\}/)?.[0] || "";
    expect(cardRule).toContain("border:1px solid");
    expect(cardRule).toContain("box-shadow:");
    expect(cardRule).not.toContain("border-inline");
    expect(cardRule).not.toContain("border-right");
    expect(cardRule).not.toContain("border-left");
  });
});
