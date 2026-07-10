import { expect, test } from "@playwright/test";

test("linked devices page connects WhatsApp and runs device actions", async ({ page }) => {
  await page.goto("/dashboard/linked-devices");
  await expect(page.locator("h1", { hasText: "الأجهزة المرتبطة" })).toBeVisible();

  await expect(page.locator("[data-action='device-link-method'][data-method='qr']")).toBeVisible();
  await expect(page.locator("[data-action='device-link-method'][data-method='pairing']")).toBeVisible();
  await page.locator("[data-action='device-link-method'][data-method='pairing']").click();
  await page.locator("[data-action='create-pairing-code']").click();
  await expect(page.getByText("يرجى إدخال رقم واتساب.")).toBeVisible();
  await page.locator("[data-action='pairing-phone-input']").fill("966501234567");
  await page.locator("[data-action='create-pairing-code']").click();
  await expect(page.getByText(/ينتهي خلال 60 ثانية/)).toBeVisible();

  await page.locator("[data-action='device-link-method'][data-method='qr']").click();
  await page.locator("[data-action='create-device-qr']").first().click();
  await expect(page.locator("[data-device-status='pending_qr']")).toBeVisible();
  await page.locator("[data-action='confirm-device-link']").click();

  await expect(page.locator("[data-device-status='connected']")).toBeVisible();
  await expect(page.getByText("WhatsApp iPhone 15 Pro").first()).toBeVisible();

  await page.locator("[data-action='check-device-connection']").first().click();
  await expect(page.getByText("الاتصال يعمل بنجاح")).toBeVisible();
  await page.locator("[data-action='send-device-test']").click();
  await expect(page.getByText("تمت إضافة رسالة الاختبار إلى Queue بنجاح")).toBeVisible();
});
