import { expect, test } from "@playwright/test";

test("linked devices page connects WhatsApp and runs device actions", async ({ page }) => {
  await page.goto("/dashboard/connected-devices");
  await expect(page.locator("h1", { hasText: "الأجهزة المرتبطة" })).toBeVisible();

  await page.locator("[data-action='create-device-qr']").first().click();
  await expect(page.getByText("بانتظار المسح")).toBeVisible();
  await page.locator("[data-action='copy-pairing']").click();
  await page.locator("[data-action='confirm-device-link']").click();

  await expect(page.getByText("متصل").first()).toBeVisible();
  await expect(page.getByText("WhatsApp iPhone 15 Pro").first()).toBeVisible();

  await page.locator("[data-action='check-device-connection']").first().click();
  await expect(page.getByText("الاتصال يعمل بنجاح")).toBeVisible();
  await page.locator("[data-action='send-device-test']").click();
  await expect(page.getByText("تم إرسال رسالة اختبار بنجاح")).toBeVisible();
});
