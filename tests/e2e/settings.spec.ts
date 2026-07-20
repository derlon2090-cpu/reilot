import { expect, test } from "@playwright/test";
import { hasLiveCredentials, loginWithLiveCredentials } from "./helpers/live-auth";

test.skip(!hasLiveCredentials, "requires a real authenticated test account");

test("settings cards keep the required RTL order and interface preferences persist", async ({ page }) => {
  await loginWithLiveCredentials(page);
  await page.goto("/dashboard/settings");
  const cards = page.locator(".settings-layout > article");
  await expect(cards).toHaveCount(5);
  await expect(cards.nth(0)).toContainText("إعدادات الحساب");
  await expect(cards.nth(1)).toContainText("الأمان");
  await expect(cards.nth(2)).toContainText("الواجهة واللغة");
  await expect(cards.nth(3)).toContainText("الإشعارات");
  const language = page.locator("select[data-preference='language']");
  await language.selectOption("en");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});
