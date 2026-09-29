import { expect, test } from "@playwright/test";
import path from "node:path";

test("password recovery stays complete and scrollable inside an iPad landscape viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    sessionStorage.setItem("renvix.passwordReset.email", "owner@example.com");
    sessionStorage.setItem("renvix.passwordReset.step", "2");
  });
  await page.goto("/reset-password", { waitUntil: "domcontentloaded" });
  const panel = page.locator(".auth-suite-reset>.auth-suite-panel");
  await expect(panel.getByRole("heading", { name: "تعيين كلمة مرور جديدة" })).toBeVisible();
  await expect(panel.locator(".auth-recovery-progress li")).toHaveCount(2);
  const verificationCode = panel.getByRole("group", { name: "رمز التحقق المكوّن من ستة أرقام" });
  await expect(verificationCode.getByRole("textbox")).toHaveCount(6);
  await expect(verificationCode.getByRole("textbox").first()).toBeVisible();
  await expect(panel.locator('input[name="password"]')).toBeVisible();
  await expect(panel.locator('input[name="confirmPassword"]')).toBeVisible();
  await expect(panel.getByRole("button", { name: "تعيين كلمة المرور" })).toBeVisible();

  const geometry = await panel.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const submit = element.querySelector("button.auth-submit")?.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, submitBottom: submit?.bottom || 0, viewportHeight: innerHeight, documentHeight: document.documentElement.scrollHeight };
  });
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.documentHeight).toBeGreaterThan(geometry.viewportHeight);
  const submit = panel.getByRole("button", { name: "تعيين كلمة المرور" });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeVisible();
  const submitBox = await submit.boundingBox();
  expect(submitBox && submitBox.y + submitBox.height <= geometry.viewportHeight + 1).toBe(true);
  await page.screenshot({ path: path.resolve("test-results-ipad-fix/password-recovery-1280x720.png") });
});
