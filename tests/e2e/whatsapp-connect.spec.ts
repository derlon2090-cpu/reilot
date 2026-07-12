import { expect, test } from "@playwright/test";
import { hasLiveCredentials, loginWithLiveCredentials } from "./helpers/live-auth";

test.skip(!hasLiveCredentials || process.env.E2E_LIVE_WHATSAPP !== "1", "requires live Evolution API verification");

test("@critical linked devices renders a real QR and a real pairing result or explicit error", async ({ page }) => {
  await loginWithLiveCredentials(page);
  await page.goto("/dashboard/linked-devices");
  await expect(page.locator("[data-action='device-link-method'][data-method='qr']")).toBeVisible();
  await expect(page.locator(".qr-real")).toHaveCount(0);
  await expect(page.getByText("الباركود جاهز للمسح")).toHaveCount(0);

  const createResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/whatsapp/instances/create") && response.request().method() === "POST");
  const qrResponsePromise = page.waitForResponse((response) => /\/api\/whatsapp\/instances\/[^/]+\/qr$/.test(new URL(response.url()).pathname));
  await page.locator("[data-action='create-device-qr']").first().click();
  const createResponse = await createResponsePromise;
  const qrResponse = await qrResponsePromise;
  expect(createResponse.status()).toBeLessThan(300);
  expect(qrResponse.status()).toBe(200);

  const createPayload = await createResponse.json();
  const qrPayload = await qrResponse.json();
  expect(qrPayload.qrBase64).toMatch(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]{1000,}$/);
  const qrImage = page.locator(".qr-real").first();
  await expect(qrImage).toBeVisible();
  expect(await qrImage.evaluate((image: HTMLImageElement) => image.naturalWidth > 0 && image.naturalHeight > 0)).toBe(true);
  await expect(page.getByText("الباركود جاهز للمسح")).toBeVisible();
  await page.screenshot({ path: "test-results/critical-whatsapp-qr.png", fullPage: true });

  await page.locator("[data-action='device-link-method'][data-method='pairing']").click();
  await page.locator("[data-action='pairing-phone-input']").fill("966 556 915 980");
  const pairingResponsePromise = page.waitForResponse((response) => /\/api\/whatsapp\/instances\/[^/]+\/pairing-code$/.test(new URL(response.url()).pathname));
  await page.locator("[data-action='create-pairing-code']").click();
  const pairingResponse = await pairingResponsePromise;
  const pairingPayload = await pairingResponse.json();

  if (pairingResponse.ok()) {
    expect(pairingPayload.pairingCode).toBeTruthy();
    await expect(page.getByText(pairingPayload.pairingCode, { exact: true })).toBeVisible();
  } else {
    expect([501, 502]).toContain(pairingResponse.status());
    await expect(page.locator("[data-pairing-error]")).toBeVisible();
    await expect(page.locator("[data-pairing-error]")).not.toHaveText("");
  }
  await page.screenshot({ path: "test-results/critical-pairing-result.png", fullPage: true });

  const instanceId = createPayload.instance?.id;
  if (instanceId) await page.request.delete(`/api/whatsapp/instances/${instanceId}`);
});
