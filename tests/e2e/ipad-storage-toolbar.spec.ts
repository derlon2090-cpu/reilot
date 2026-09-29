import { expect, test } from "@playwright/test";
import path from "node:path";
import { installMockPortalBasics, openMockPortalRoute } from "./helpers/mock-portal";

test("storage toolbar controls stay complete inside an iPad landscape card", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installMockPortalBasics(page);
  await page.route("**/api/storage?*", (route) => route.fulfill({ json: {
    ok: true,
    storage: {
      currentFolderId: "",
      imagesFolderId: "images",
      filesFolderId: "files",
      folders: [], allFolders: [], documents: [], assets: [], activity: [], recentlyOpened: [],
      counts: { folders: 0, documents: 0, images: 0, recent: 0 },
      usage: { usedBytes: 0, limitBytes: 104857600, percent: 0, progressPercent: 0, isUnlimited: false }
    }
  } }));
  await openMockPortalRoute(page, "/dashboard/storage");

  const browser = page.locator(".storage-browser");
  const toolbar = browser.locator(".storage-toolbar");
  await expect(browser).toBeVisible({ timeout: 20_000 });
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator(":scope > label, :scope > select, :scope > input, :scope > div")).toHaveCount(5);

  const geometry = await browser.evaluate((card) => {
    const cardBox = card.getBoundingClientRect();
    const toolbarElement = card.querySelector<HTMLElement>(".storage-toolbar");
    const toolbarBox = toolbarElement?.getBoundingClientRect();
    const controls = Array.from(toolbarElement?.children || []).map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width };
    });
    return {
      card: { left: cardBox.left, right: cardBox.right },
      toolbar: toolbarBox ? { left: toolbarBox.left, right: toolbarBox.right } : null,
      controls,
      viewportWidth: innerWidth
    };
  });

  expect(geometry.toolbar).not.toBeNull();
  expect(geometry.toolbar!.left).toBeGreaterThanOrEqual(0);
  expect(geometry.toolbar!.right).toBeLessThanOrEqual(geometry.viewportWidth);
  for (const control of geometry.controls) {
    expect(control.width).toBeGreaterThan(40);
    expect(control.left).toBeGreaterThanOrEqual(0);
    expect(control.right).toBeLessThanOrEqual(geometry.viewportWidth);
  }

  await page.screenshot({ path: path.resolve("test-results-ipad-fix/storage-toolbar-1280x720.png") });
});
