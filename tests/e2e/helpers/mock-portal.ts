import { expect, type Page } from "@playwright/test";

export async function installMockPortalBasics(page: Page) {
  await page.route("**/api/auth/session", (route) => route.fulfill({
    json: { ok: true, user: { id: "user-1", name: "مستخدم الاختبار", role: "owner", mustChangePassword: false } }
  }));
  await page.route("**/api/dashboard/overview", (route) => route.fulfill({
    json: { ok: true, stats: {}, profile: { name: "مستخدم الاختبار" } }
  }));
  await page.route("**/api/billing/message-usage", (route) => route.fulfill({
    json: { ok: true, used: 0, limit: 100 }
  }));
  await page.route("**/api/notifications**", (route) => route.fulfill({
    json: { ok: true, items: [], unreadCount: 0 }
  }));
}

export const mockChannelsPayload = {
  ok: true,
  summary: {
    connectedChannels: 2,
    verifiedDomains: 1,
    activeSenders: 1,
    totalMessages: 250,
    sent: 250,
    delivered: 240,
    deliveryRate: 96,
    openRate: 61,
    replies: 18,
    whatsappMessages: 180,
    emailMessages: 70,
    approvedTemplates: 4,
    whatsappCampaigns: 3
  },
  channels: {
    whatsapp: {
      connected: true,
      items: [{
        id: "meta-1",
        provider: "meta_cloud_api",
        name: "Renvix Store",
        phoneNumber: "966500000001",
        status: "connected",
        lastHealthCheckAt: "2026-09-28T10:00:00.000Z"
      }]
    },
    email: {
      connected: true,
      domain: "notify.renvix.app",
      sender: "noreply@notify.renvix.app"
    }
  },
  activity: [{ id: "activity-1", channel: "whatsapp", status: "delivered", createdAt: "2026-09-28T10:00:00.000Z" }]
};

export async function openMockPortalRoute(page: Page, pathname: string) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /أدر اشتراكات عملائك/ })).toBeVisible({ timeout: 30_000 });
  await page.evaluate((route) => {
    const config = (window as Window & { __RENVIX_CONFIG__?: Record<string, unknown> }).__RENVIX_CONFIG__;
    if (config) {
      config.siteUrl = location.origin;
      config.authUrl = location.origin;
      config.appUrl = location.origin;
      config.adminUrl = location.origin;
      config.authApiUrl = location.origin;
    }
    history.pushState({}, "", route);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, pathname);
}
