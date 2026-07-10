import { expect, test } from "@playwright/test";

test("login flow opens the dashboard after valid form input", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("form[data-submit='login']")).toBeVisible();
  await page.locator("input[name='email']").fill("owner@example.com");
  await page.locator("input[name='password']").fill("correct-password");
  await page.locator("form[data-submit='login'] button.btn-primary").click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".dashboard-shell")).toBeVisible();
});
