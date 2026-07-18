import { expect, test } from "@playwright/test";
import { hasLiveCredentials, loginWithLiveCredentials } from "./helpers/live-auth";

const routes = [
  "/", "/features", "/pricing", "/support", "/login", "/register", "/forgot-password",
  "/dashboard", "/dashboard/subscriptions", "/dashboard/customers", "/dashboard/renewals",
  "/dashboard/notifications", "/dashboard/linked-devices", "/dashboard/whatsapp-safety",
  "/dashboard/unsubscribe", "/dashboard/warranty", "/dashboard/reports", "/dashboard/activity",
  "/dashboard/billing", "/dashboard/settings", "/dashboard/readiness", "/dashboard/issues"
];

test("English mode translates every required page and persists direction", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem("renewpilot_locale", "en");
    localStorage.setItem("renewpilot_theme", "light");
  });

  let authenticated = false;
  for (const route of routes) {
    if (route.startsWith("/dashboard") && !hasLiveCredentials) continue;
    if (route.startsWith("/dashboard") && !authenticated) {
      await loginWithLiveCredentials(page);
      authenticated = true;
    }
    await page.goto(route);
    await expect(page.locator("#app > *")).toBeVisible();
    const audit = await page.locator("body").innerText();
    expect(audit, `${route} contains untranslated fallback`).not.toContain("Renvix content");
    expect(audit, `${route} contains Arabic UI text`).not.toMatch(/[\u0600-\u06ff]/);
    const attributes = await page.locator("[placeholder], [title], [aria-label]").evaluateAll((elements) => elements.flatMap((element) => ["placeholder", "title", "aria-label"].map((name) => element.getAttribute(name) || "")));
    expect(attributes.join("\n"), `${route} contains untranslated attributes`).not.toContain("Renvix content");
    expect(attributes.join("\n"), `${route} contains Arabic attributes`).not.toMatch(/[\u0600-\u06ff]/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  }

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("validation, dialog text, and toasts follow the selected language", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("renewpilot_locale", "en");
    localStorage.setItem("renewpilot_theme", "light");
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(page.getByText("Please enter your email address.")).toBeVisible();

  if (!hasLiveCredentials) return;
  await loginWithLiveCredentials(page);
  await page.goto("/dashboard/subscriptions");
  await page.locator("[data-action='add-subscription']").click();
  const dialogText = await page.locator(".modal").innerText();
  expect(dialogText).not.toContain("Renvix content");
  expect(dialogText).not.toMatch(/[\u0600-\u06ff]/);
});

test("Arabic mode and theme remain consistent across public and dashboard pages", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("renewpilot_locale", "ar");
    localStorage.setItem("renewpilot_theme", "dark");
  });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  if (!hasLiveCredentials) return;
  await loginWithLiveCredentials(page);
  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { name: "الإعدادات" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
