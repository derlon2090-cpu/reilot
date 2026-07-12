import { expect, type Page } from "@playwright/test";

export const liveEmail = process.env.E2E_TEST_EMAIL || "";
export const livePassword = process.env.E2E_TEST_PASSWORD || "";
export const hasLiveCredentials = Boolean(liveEmail && livePassword);

export async function loginWithLiveCredentials(page: Page) {
  await page.goto("/login");
  await page.locator("input[name='email']").fill(liveEmail);
  await page.locator("input[name='password']").fill(livePassword);
  await page.locator("form[data-submit='login'] button.btn-primary").click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".dashboard-shell")).toBeVisible();
}
