import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("static entry never ships the old wait card or timeout replacement", async () => {
  const html = await readFile("index.html", "utf8");
  expect(html).not.toContain("جارٍ تجهيز Renvix");
  expect(html).not.toContain("تعذر فتح الصفحة مؤقتًا");
  expect(html).toContain("منصة واحدة لإدارة اشتراكاتك وتنمية أعمالك");
});

test("login is server rendered without the startup splash", async ({ page }) => {
  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });

  expect(response?.ok()).toBeTruthy();
  const initialHtml = await response!.text();
  expect(initialHtml).toContain("أهلًا بعودتك");
  expect(initialHtml).toContain('name="email"');
  expect(initialHtml).toContain('name="password"');
  expect(initialHtml).not.toContain("جارٍ تجهيز Renvix");
  expect(initialHtml).not.toContain("تعذر فتح الصفحة مؤقتًا");

  await expect(page.getByRole("heading", { name: "أهلًا بعودتك" })).toBeVisible();
  await expect(page.locator('#app input[name="email"]')).toBeVisible();
  await expect(page.locator('#app input[name="password"]')).toBeVisible();
});

test("site entry has useful content immediately instead of a loading card", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });

  expect(response?.ok()).toBeTruthy();
  const initialHtml = await response!.text();
  expect(initialHtml).toContain("منصة واحدة لإدارة اشتراكاتك وتنمية أعمالك");
  expect(initialHtml).not.toContain("جارٍ تجهيز Renvix");
  await expect(page.getByRole("heading", { name: "Renvix" })).toBeVisible();
  await expect(page.getByRole("link", { name: "تسجيل الدخول" })).toBeVisible();
});
