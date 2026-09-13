import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/app.js", "utf8");
const moveFunctions = source.slice(source.indexOf("let storageDraggedItem = null;"), source.indexOf('document.addEventListener("dragstart"'));
const moveActions = source.slice(source.indexOf("async function handleAction(target)"), source.indexOf('  if (storageAction === "storage-reload")')) + "}";
const selectionStart = source.indexOf("function selectStorageArrangeCard(");
const selectionHandlers = source.slice(selectionStart, source.indexOf('document.addEventListener("dragover"', selectionStart));
const createAction = source.slice(source.indexOf('  if (storageAction === "storage-new-container")'), source.indexOf('  if (storageAction === "storage-new-folder")'));

test("Add File opens a named empty container form, not a document editor or file upload", async ({ page }) => {
  await page.setContent('<button data-action="storage-new-container">إضافة ملف جديد</button><div id="portal"></div>');
  await page.addScriptTag({ content: `
    const dashboardIcon = () => "";
    const openModal = (title, body) => { document.querySelector("#portal").innerHTML = "<h2>" + title + "</h2>" + body; };
    async function createContainer(target) { const storageAction = target.dataset.action; ${createAction} }
    document.querySelector("button").addEventListener("click", event => void createContainer(event.target));
  ` });
  await page.getByRole("button", { name: "إضافة ملف جديد", exact: true }).click();
  await expect(page.locator('#portal form[data-submit="storage-folder"]')).toBeVisible();
  await page.getByLabel("اسم الملف").fill("حسابات أبل الهند");
  await expect(page.getByRole("button", { name: "إنشاء الملف", exact: true })).toBeVisible();
  await expect(page.locator('input[type="file"], [data-storage-editor], form[data-submit="storage-document"]')).toHaveCount(0);
});

test("explicit move button selects a container, supports touch targets and persists the new location", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.setContent('<section class="storage-center"><section class="storage-browser"><article class="storage-folder-card" data-id="container"><h3>حسابات أبل الهند</h3></article><article class="storage-file-card" data-storage-draggable data-storage-kind="document" data-storage-name="مستند اختبار" data-id="doc"><h3>مستند اختبار</h3></article></section></section>');
  await page.addStyleTag({ content: readFileSync("src/styles/globals.css", "utf8") });
  await page.addScriptTag({ content: `
    const state = { route: "/dashboard/storage", storageCenter: { storage: { currentFolderId: "files", folders: [{ id: "container", name: "حسابات أبل الهند", parentId: "files" }], allFolders: [{ id: "files", name: "الملفات", systemType: "files" }, { id: "container", name: "حسابات أبل الهند", parentId: "files" }, { id: "child", name: "ملف داخلي", parentId: "container" }, { id: "target", name: "مكان جديد" }], documents: [{ id: "doc", name: "مستند اختبار", type: "custom", folderId: "files" }], assets: [] } } };
    const escapeHtml = value => String(value || "").replace(/[&<>"']/g, "");
    const dashboardIcon = () => "";
    const closePortal = () => {};
    const toast = () => {};
    let lastMove = null;
    const fetchJson = async (url, options) => { lastMove = { url, body: JSON.parse(options.body) }; };
    const syncRouteData = async () => {};
    const render = () => bindStorageMoveControls();
    ${moveFunctions}
    ${moveActions}
    ${selectionHandlers}
    document.addEventListener("click", event => { const action = event.target.closest("[data-action]"); if (action) void handleAction(action); });
    bindStorageMoveControls();
  ` });
  const move = page.getByRole("button", { name: "تحريك الملفات والمستندات" });
  await expect(move).toBeVisible();
  await expect(page.locator('.storage-folder-card [data-action="storage-start-move"]')).toHaveCount(0);
  await expect(page.locator('.storage-folder-card')).toHaveAttribute("draggable", "false");
  await move.click();
  await expect(page.locator('.storage-folder-card')).toHaveAttribute("draggable", "true");
  await page.getByRole("button", { name: "اختيار حسابات أبل الهند للتحريك" }).click();
  await expect(page.locator(".storage-moving-selected")).toHaveCount(1);
  await expect(page.locator(".storage-move-mode")).toBeVisible();
  await expect(page.locator('.storage-move-mode [data-storage-drop-folder="container"]')).toHaveCount(0);
  await expect(page.locator('.storage-move-mode [data-storage-drop-folder="child"]')).toHaveCount(0);
  await page.getByRole("button", { name: "إلغاء التحريك" }).click();
  await expect(page.locator(".storage-move-mode")).toHaveCount(0);
  await expect(page.locator(".storage-moving-selected")).toHaveCount(0);
  const doc = page.getByRole("button", { name: "اختيار مستند اختبار للتحريك" });
  await doc.focus();
  await doc.press("Enter");
  await expect(page.locator('.storage-file-card')).toHaveClass(/storage-moving-selected/);
  await page.keyboard.press("Escape");
  await expect(move).toBeVisible();
  await expect(page.locator('.storage-file-card')).toHaveAttribute("draggable", "false");
  await move.click();
  await page.getByRole("button", { name: "اختيار حسابات أبل الهند للتحريك" }).click();
  await page.getByRole("button", { name: "مكان جديد", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).eval("lastMove"))).toEqual({ url: "/api/storage/items/container/move", body: { kind: "folder", folderId: "target" } });
  await expect(page.locator(".storage-move-mode")).toHaveCount(0);
  await page.getByRole("button", { name: "إنهاء التحريك" }).click();
  await expect(page.locator('.storage-folder-card')).toHaveAttribute("draggable", "false");
});
