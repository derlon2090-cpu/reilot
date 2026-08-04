import { expect, test } from "@playwright/test";

test("user devices expose official Meta state without Evolution QR or pairing controls", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { ok: true, user: { id: "user-1", role: "owner", mustChangePassword: false } } }));
  await page.route("**/api/dashboard/overview", (route) => route.fulfill({ json: { ok: true, stats: {}, profile: {} } }));
  await page.route("**/api/billing/message-usage", (route) => route.fulfill({ json: { ok: true, used: 0, limit: 100 } }));
  await page.route("**/api/notifications**", (route) => route.fulfill({ json: { ok: true, items: [], unreadCount: 0 } }));
  await page.route("**/api/whatsapp/health", (route) => route.fulfill({ json: { ok: true, connected: true, health: { status: "good" } } }));
  await page.route("**/api/whatsapp/instances/create", (route) => route.fulfill({
    json: {
      ok: true,
      instance: {
        id: "meta-1",
        provider: "meta_cloud_api",
        deviceName: "حساب Meta الرسمي",
        displayName: "Renvix Store",
        phoneNumber: "966500000001",
        status: "connected",
        isPrimary: true,
        devices: [{
          id: "meta-1",
          provider: "meta_cloud_api",
          deviceName: "حساب Meta الرسمي",
          displayName: "Renvix Store",
          phoneNumber: "966500000001",
          status: "connected",
          isPrimary: true
        }]
      }
    }
  }));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".marketing-copy")).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => {
    const link = document.createElement("button");
    link.dataset.link = "/dashboard/devices";
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  await expect(page.getByRole("heading", { name: "الأجهزة", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-action='create-device-qr']")).toHaveCount(0);
  await expect(page.locator("[data-action='device-link-method'][data-method='qr']")).toHaveCount(0);
  await expect(page.locator("[data-action='device-link-method'][data-method='pairing']")).toHaveCount(0);
  await expect(page.locator("[data-action='create-pairing-code']")).toHaveCount(0);
  await expect(page.locator(".qr-real, .qr-float, .pair-code")).toHaveCount(0);
  await expect(page.getByText(/واتساب الرسمي · Meta/).first()).toBeVisible();
});
