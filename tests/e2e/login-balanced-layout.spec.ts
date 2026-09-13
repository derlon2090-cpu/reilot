import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

for (const viewport of [{ width: 1896, height: 870 }, { width: 1280, height: 720 }]) {
  test(`sign-in stays balanced at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    if (process.env.QA_PREVIEW_STYLES === "true") {
      const styles = readFileSync("src/styles/globals.css", "utf8");
      await page.addStyleTag({ content: styles.slice(styles.indexOf("/* Restore the approved compact"), styles.indexOf("/* Complete password recovery")) });
      await page.locator(".auth-suite-shell.login").waitFor();
      await page.evaluate(() => {
        const svg = document.querySelector(".auth-suite-shell.login .auth-showcase-reference-art");
        svg?.querySelector("defs")?.insertAdjacentHTML("beforeend", '<clipPath id="auth-login-label-clip" clipPathUnits="userSpaceOnUse"><path clip-rule="evenodd" d="M0 0H1127V1038H0Z M20 137H210V195H20Z M940 145H1127V207H940Z M5 465H170V563H5Z M5 820H170V926H5Z M282 862H1037V1038H282Z"></path></clipPath>');
        const image = svg?.querySelector("image");
        image?.removeAttribute("mask");
        image?.setAttribute("clip-path", "url(#auth-login-label-clip)");
      });
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      const source = document.querySelector(".auth-showcase-reference-art image")?.getAttribute("href");
      if (source) await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Sign-in illustration failed to load"));
        image.src = source;
      });
    });
    const shell = page.locator(".auth-suite-shell.login");
    await expect(shell).toBeVisible();
    await expect(shell.locator('input[name="email"]')).toBeVisible();
    await expect(shell.locator('input[name="password"]')).toBeVisible();
    await expect(shell.locator(".auth-submit")).toBeVisible();
    const geometry = await shell.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const panel = element.querySelector(".auth-suite-panel")!.getBoundingClientRect();
      const input = element.querySelector('input[name="email"]')!.getBoundingClientRect();
      const actions = element.querySelector(".inline-actions")!.getBoundingClientRect();
      const submit = element.querySelector(".auth-submit")!.getBoundingClientRect();
      const title = element.querySelector(".auth-showcase-copy h2")!;
      return { width: box.width, panelWidth: panel.width, inputHeight: input.height,
        submitHeight: submit.height, submitTop: submit.top, actionsBottom: actions.bottom,
        bottom: submit.bottom, viewportHeight: innerHeight,
        titleSize: parseFloat(getComputedStyle(title).fontSize) };
    });
    expect(geometry.width).toBeLessThanOrEqual(1021);
    expect(geometry.panelWidth).toBeGreaterThan(350);
    expect(geometry.inputHeight).toBeLessThanOrEqual(49);
    expect(geometry.submitHeight).toBeLessThanOrEqual(49);
    expect(geometry.submitTop - geometry.actionsBottom).toBeLessThan(130);
    expect(geometry.bottom).toBeLessThan(viewport.height);
    expect(geometry.titleSize).toBeLessThanOrEqual(30);
    await page.screenshot({ path: path.resolve(`test-results-ipad-fix/login-balanced-${viewport.width}x${viewport.height}.png`) });
  });
}
