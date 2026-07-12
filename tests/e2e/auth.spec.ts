import { expect, test } from "@playwright/test";
import { hasLiveCredentials, liveEmail, livePassword } from "./helpers/live-auth";

test.skip(!hasLiveCredentials, "requires a real authenticated test account");

test("@critical authentication rejects random and wrong credentials before allowing a valid login", async ({ page, request }) => {
  test.setTimeout(90_000);
  const randomResponse = await request.post("/api/auth/login", {
    data: { email: "random-anything@test.com", password: "Anything@123" }
  });
  expect(randomResponse.status()).toBe(401);
  expect(randomResponse.headers()["set-cookie"]).toBeUndefined();

  const wrongResponse = await request.post("/api/auth/login", {
    data: { email: liveEmail, password: "Wrong@999" }
  });
  expect(wrongResponse.status()).toBe(401);
  expect(wrongResponse.headers()["set-cookie"]).toBeUndefined();

  const anonymousDashboard = await request.get("/dashboard", { maxRedirects: 0 });
  expect(anonymousDashboard.status()).toBe(307);
  expect(anonymousDashboard.headers().location).toBe("/login");

  await page.goto("/login");
  const submit = page.locator("form[data-submit='login'] button.btn-primary");
  await page.locator("input[name='email']").fill("random-anything@test.com");
  await page.locator("input[name='password']").fill("Anything@123");
  const randomUiResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST");
  await submit.click();
  expect((await randomUiResponse).status()).toBe(401);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator(".toast.danger")).toBeVisible();
  await expect(submit).toBeEnabled();
  await page.screenshot({ path: "test-results/critical-random-login.png", fullPage: true });

  await page.locator("input[name='email']").fill(liveEmail);
  await page.locator("input[name='password']").fill("Wrong@999");
  const wrongUiResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST");
  await submit.click();
  expect((await wrongUiResponse).status()).toBe(401);
  await expect(page).toHaveURL(/\/login$/);
  await expect(submit).toBeEnabled();

  await page.locator("input[name='password']").fill(livePassword);
  const validUiResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST");
  await submit.click();
  expect((await validUiResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".dashboard-shell")).toBeVisible();
  const session = await page.request.get("/api/auth/session");
  expect(session.status()).toBe(200);
});
