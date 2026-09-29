import { expect, test } from "@playwright/test";
import { installMockPortalBasics, mockChannelsPayload, openMockPortalRoute } from "./helpers/mock-portal";

test("user devices expose official Meta state without Evolution QR or pairing controls", async ({ page }) => {
  await installMockPortalBasics(page);
  await page.route("**/api/channels", (route) => route.fulfill({ json: mockChannelsPayload }));
  await openMockPortalRoute(page, "/dashboard/channels/whatsapp");

  await expect(page.getByRole("heading", { name: /واتساب الرسمية/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-action='create-device-qr']")).toHaveCount(0);
  await expect(page.locator("[data-action='device-link-method'][data-method='qr']")).toHaveCount(0);
  await expect(page.locator("[data-action='device-link-method'][data-method='pairing']")).toHaveCount(0);
  await expect(page.locator("[data-action='create-pairing-code']")).toHaveCount(0);
  await expect(page.locator(".qr-real, .qr-float, .pair-code")).toHaveCount(0);
  await expect(page.getByText("Meta WhatsApp", { exact: true })).toBeVisible();
  await expect(page.getByText("القناة متصلة وموثقة", { exact: true })).toBeVisible();
  await expect(page.getByText("تم التحقق من Meta", { exact: true })).toBeVisible();
});
