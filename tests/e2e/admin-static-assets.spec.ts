import { expect, test } from "@playwright/test";

const adminHost = process.env.E2E_ADMIN_HOST || "wa-admin.renvix.app";

test.use({
  extraHTTPHeaders: {
    "x-forwarded-host": adminHost
  }
});

test("admin login loads same-origin CSS, hydrates, and submits without a native reload", async ({ page }) => {
  const staticResponses = new Map<string, { status: number; contentType: string }>();
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/_next/static/")
      || url.pathname.startsWith("/app/")
      || url.pathname.startsWith("/assets/")
      || url.pathname.startsWith("/data/")
    ) {
      staticResponses.set(response.url(), {
        status: response.status(),
        contentType: response.headers()["content-type"] || ""
      });
    }
  });

  await page.route("**/api/admin/auth/login", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, reason: "invalid_credentials" })
    });
  });

  await page.goto("/advanced-pro-control", { waitUntil: "networkidle" });

  const pageOrigin = new URL(page.url()).origin;
  const cssEntries = [...staticResponses.entries()].filter(([url]) => {
    const pathname = new URL(url).pathname;
    return pathname.endsWith(".css") && (pathname.startsWith("/_next/static/") || pathname.startsWith("/app/styles/"));
  });
  const scriptEntries = [...staticResponses.entries()].filter(([url]) => {
    const pathname = new URL(url).pathname;
    return (pathname.startsWith("/_next/static/chunks/") && pathname.endsWith(".js")) || pathname === "/app/app.js";
  });

  expect(cssEntries.length).toBeGreaterThan(0);
  expect(scriptEntries.length).toBeGreaterThan(0);
  for (const [url, response] of [...cssEntries, ...scriptEntries]) {
    expect(new URL(url).origin).toBe(pageOrigin);
    expect(response.status).toBe(200);
  }
  expect(cssEntries.some(([, response]) => response.contentType.includes("text/css"))).toBe(true);
  expect(scriptEntries.some(([, response]) => response.contentType.includes("javascript"))).toBe(true);

  const loadedResourcePaths = await page.evaluate(() => performance.getEntriesByType("resource")
    .map((entry) => new URL(entry.name).pathname));
  for (const pathname of [
    "/app/app.js",
    "/app/auth-turnstile.js",
    "/app/locales/ar.json",
    "/data/publicData.js",
    "/data/sallaPageCss.js",
    "/data/sallaTemplateUi.js",
    "/app/styles/tokens.css",
    "/app/styles/globals.css",
    "/app/styles/dark-system.css"
  ]) {
    const entry = [...staticResponses.entries()].find(([url]) => new URL(url).pathname === pathname);
    expect(entry || loadedResourcePaths.includes(pathname), `${pathname} should load from the admin origin`).toBeTruthy();
    if (entry) expect(new URL(entry[0]).origin).toBe(pageOrigin);
    const verification = await page.request.get(pathname);
    expect(verification.status(), `${pathname} should return 200 from the admin origin`).toBe(200);
  }

  const loadedCssRuleCount = await page.evaluate(() => [...document.styleSheets]
    .filter((sheet) => sheet.href && new URL(sheet.href).origin === location.origin)
    .reduce((count, sheet) => count + (sheet.cssRules?.length || 0), 0));
  expect(loadedCssRuleCount).toBeGreaterThan(0);

  const email = page.getByLabel("البريد الإلكتروني");
  const password = page.locator('input[type="password"]');
  await email.fill("invalid-admin@example.com");
  await password.fill("definitely-not-the-password");

  const initialUrl = page.url();
  const initialNavigationCount = await page.evaluate(() => performance.getEntriesByType("navigation").length);
  await page.getByRole("button", { name: /دخول إلى لوحة الأدمن/ }).click();

  await expect(page.getByRole("alert").filter({ hasText: "تعذر الوصول إلى لوحة الأدمن" })).toBeVisible();
  await expect(email).toHaveValue("invalid-admin@example.com");
  await expect(password).toHaveValue("definitely-not-the-password");
  expect(page.url()).toBe(initialUrl);
  expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(initialNavigationCount);
});
