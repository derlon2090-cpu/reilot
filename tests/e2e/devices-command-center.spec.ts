import { expect, test } from "@playwright/test";

test("devices command center matches the RTL reference and keeps real actions usable", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { ok: true, user: { id: "user-1", role: "owner", mustChangePassword: false } } }));
  await page.route("**/api/dashboard/overview", (route) => route.fulfill({ json: { ok: true, stats: {}, profile: {} } }));
  await page.route("**/api/billing/message-usage", (route) => route.fulfill({ json: { ok: true, used: 0, limit: 100 } }));
  await page.route("**/api/notifications**", (route) => route.fulfill({ json: { ok: true, items: [], unreadCount: 0 } }));
  await page.route("**/api/whatsapp/health", (route) => route.fulfill({ json: { ok: true, connected: true, health: { status: "good" } } }));

  const devices = [
    { id: "device-1", provider: "meta_cloud_api", deviceName: "حساب المتجر الرئيسي", displayName: "Renvix Store", phoneNumber: "966500000001", status: "connected", lastHealthCheckAt: "2026-07-31T16:00:00.000Z", updatedAt: "2026-07-31T16:00:00.000Z", isPrimary: true, requiresAttention: false },
    { id: "device-2", provider: "evolution", deviceName: "جهاز خدمة العملاء", displayName: "Support", phoneNumber: "966500000002", status: "error", lastHealthCheckAt: "2026-07-31T15:00:00.000Z", updatedAt: "2026-07-31T15:00:00.000Z", lastError: "تعذر الاتصال", requiresAttention: true }
  ];
  await page.route("**/api/whatsapp/instances/create", (route) => route.fulfill({
    json: {
      ok: true,
      instance: {
        ...devices[0],
        devices,
        activity: [
          { id: "activity-1", type: "device.connection_test_succeeded", title: "نجح اختبار اتصال الجهاز", deviceName: "حساب المتجر الرئيسي", createdAt: "2026-07-31T16:00:00.000Z" },
          { id: "activity-2", type: "device.connection_test_failed", title: "فشل اختبار اتصال الجهاز", deviceName: "جهاز خدمة العملاء", createdAt: "2026-07-31T15:00:00.000Z" }
        ]
      }
    }
  }));
  await page.route("**/api/whatsapp/instances/device-2/check", (route) => route.fulfill({ json: { ok: true, status: "connected", checkedAt: new Date().toISOString() } }));

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
  await expect(page.locator(".devices-overview-card")).toHaveCount(4);
  await expect(page.locator(".devices-table-scroll tbody tr")).toHaveCount(2);
  await expect(page.locator(".devices-readiness-card")).toBeVisible();
  await expect(page.locator(".devices-activity-card")).toContainText("نجح اختبار اتصال الجهاز");

  const overviewBorder = await page.locator(".devices-overview-card").first().evaluate((element) => ({
    left: getComputedStyle(element).borderLeftWidth,
    right: getComputedStyle(element).borderRightWidth
  }));
  expect(overviewBorder.left).toBe(overviewBorder.right);
  await page.screenshot({ path: ".codex-artifacts/devices-command-center.png", fullPage: true });

  await page.locator('[data-action="device-search"]').evaluate((input: HTMLInputElement) => {
    input.value = "خدمة العملاء";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator(".devices-table-scroll tbody tr")).toHaveCount(1);
  await page.locator('[data-action="device-details"]').first().click();
  await expect(page.getByText("تفاصيل الجهاز", { exact: true })).toBeVisible();
  await page.screenshot({ path: ".codex-artifacts/devices-device-details.png", fullPage: true });
});
