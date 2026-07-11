import { expect, test } from "@playwright/test";

test("wrong password is rejected before a valid password opens the dashboard", async ({ page }) => {
  let sessionActive = false;

  await page.route("**/api/auth/login", async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    const valid = body.email === "owner@example.com" && body.password === "Test@12345";
    sessionActive = valid;
    await route.fulfill({
      status: valid ? 200 : 401,
      contentType: "application/json",
      body: JSON.stringify(valid ? { ok: true, user: { email: body.email } } : { ok: false, reason: "invalid_credentials" })
    });
  });
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: sessionActive ? 200 : 401,
      contentType: "application/json",
      body: JSON.stringify(sessionActive ? { ok: true, user: { email: "owner@example.com" } } : { ok: false })
    });
  });

  await page.goto("/login");
  const email = page.locator("input[name='email']");
  const password = page.locator("input[name='password']");
  const submit = page.locator("form[data-submit='login'] button.btn-primary");

  await email.fill("owner@example.com");
  await password.fill("Wrong@999");
  await submit.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator(".toast.danger")).toBeVisible();

  await password.fill("Test@12345");
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".dashboard-shell")).toBeVisible();
});
