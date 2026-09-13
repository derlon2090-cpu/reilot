import { expect, test } from "@playwright/test";
import path from "node:path";

test("password recovery stays complete inside an iPad landscape viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    sessionStorage.setItem("renvix.passwordReset.email", "owner@example.com");
    sessionStorage.setItem("renvix.passwordReset.step", "2");
  });
  await page.goto("/reset-password", { waitUntil: "domcontentloaded" });
  const panel = page.locator(".auth-suite-reset>.auth-suite-panel");
  await expect(panel.getByRole("heading", { name: "استعادة كلمة المرور" })).toBeVisible();
  await expect(panel.locator(".auth-recovery-progress li")).toHaveCount(2);
  await expect(panel.locator('input[autocomplete="one-time-code"]')).toBeVisible();
  await expect(panel.locator('input[name="password"]')).toBeVisible();
  await expect(panel.locator('input[name="confirmPassword"]')).toBeVisible();
  await expect(panel.getByRole("button", { name: "تعيين كلمة المرور" })).toBeVisible();

  const geometry = await panel.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const submit = element.querySelector("button.auth-submit")?.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, submitBottom: submit?.bottom || 0, viewportHeight: innerHeight };
  });
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  expect(geometry.submitBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  await page.screenshot({ path: path.resolve("test-results-ipad-fix/password-recovery-1280x720.png") });
});
