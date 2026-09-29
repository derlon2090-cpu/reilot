import { expect, test } from "@playwright/test";
import { installMockPortalBasics, mockChannelsPayload, openMockPortalRoute } from "./helpers/mock-portal";

test("channels command center matches the RTL reference and exposes real channel actions", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await installMockPortalBasics(page);
  await page.route("**/api/channels", (route) => route.fulfill({ json: mockChannelsPayload }));
  await openMockPortalRoute(page, "/dashboard/channels");

  await expect(page.getByRole("heading", { name: "القنوات والربط", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".ref-metrics > article")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "واتساب الرسمية", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "البريد الإلكتروني", exact: true })).toBeVisible();
  await expect(page.getByText("966500000001", { exact: true })).toBeVisible();
  await expect(page.getByText("notify.renvix.app", { exact: true })).toBeVisible();

  const overviewBorder = await page.locator(".suite-channel-hero").first().evaluate((element) => ({
    left: getComputedStyle(element).borderLeftWidth,
    right: getComputedStyle(element).borderRightWidth
  }));
  expect(overviewBorder.left).toBe(overviewBorder.right);
  await page.screenshot({ path: ".codex-artifacts/channels-command-center.png", fullPage: true });

  await page.getByRole("button", { name: "إدارة القناة", exact: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/channels\/whatsapp$/);
  await expect(page.getByRole("heading", { name: /واتساب الرسمية/ })).toBeVisible();
  await expect(page.getByText("Meta WhatsApp", { exact: true })).toBeVisible();
});
