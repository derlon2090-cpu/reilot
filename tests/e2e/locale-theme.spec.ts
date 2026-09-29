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
    localStorage.setItem("renvix.auth.language", "en");
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
    await expect(page.getByRole("main")).toBeVisible();
    const attributes = await page.locator("[placeholder], [title], [aria-label]").evaluateAll((elements) => elements.flatMap((element) => ["placeholder", "title", "aria-label"].map((name) => element.getAttribute(name) || "")));
    expect(attributes.join("\n"), `${route} contains untranslated attributes`).not.toContain("Renvix content");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  }

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("validation, dialog text, and toasts follow the selected language", async ({ page }) => {
  await page.goto("/login");
  await page.locator('[data-action="auth-display-language"][data-language="en"]:visible').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator('input[name="password"]').fill("Valid-looking-test-password-123!");
  await page.locator('form[data-submit="login"]').evaluate((form: HTMLFormElement) => {
    form.noValidate = true;
    const submitter = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitter) {
      submitter.disabled = false;
      submitter.removeAttribute("data-submitting");
    }
    form.requestSubmit(submitter || undefined);
  });
  await expect(page.getByText("Complete the security verification", { exact: true })).toBeVisible();
  await expect(page.getByText("Please wait for verification, then try again.", { exact: true })).toBeVisible();

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
  await expect(page.getByRole("heading", { name: /أهلًا بعودتك/ })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
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
