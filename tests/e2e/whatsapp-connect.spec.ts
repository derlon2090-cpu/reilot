import { expect, test } from "@playwright/test";

test("linked devices never fabricate QR images or pairing codes", async ({ page }) => {
  const instance = {
    id: "instance-1",
    instanceName: "tenant-test-whatsapp",
    status: "not_connected",
    qrBase64: null,
    pairingCode: null,
    phoneNumber: null,
    riskScore: 0
  };

  await page.route("**/api/whatsapp/instances/create", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, instance: null }) });
      return;
    }
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, instance }) });
  });
  await page.route("**/api/whatsapp/instances/instance-1/qr", (route) => route.fulfill({
    status: 502,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: "Evolution did not return a valid QR image" })
  }));
  await page.route("**/api/whatsapp/instances/instance-1/pairing-code", (route) => route.fulfill({
    status: 501,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: "Pairing code is not supported by this Evolution instance" })
  }));

  await page.goto("/dashboard/linked-devices");
  await expect(page.locator("[data-action='device-link-method'][data-method='qr']")).toBeVisible();
  await page.locator("[data-action='create-device-qr']").first().click();
  await expect(page.locator(".qr-real")).toHaveCount(0);
  await expect(page.locator("[data-action='confirm-device-link']")).toHaveCount(0);

  await page.locator("[data-action='device-link-method'][data-method='pairing']").click();
  await page.locator("[data-action='pairing-phone-input']").fill("966501234567");
  await page.locator("[data-action='create-pairing-code']").click();
  await expect(page.getByText("ABCD-EFGH")).toHaveCount(0);
  await expect(page.locator("[data-action='confirm-device-link']")).toHaveCount(0);
});
