import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

const source = readFileSync("src/app/app.js", "utf8");
const moveFunctions = source.slice(source.indexOf("let storageDraggedItem = null;"), source.indexOf('document.addEventListener("dragstart"'));
const moveActions = source.slice(source.indexOf("async function handleAction(target)"), source.indexOf('  if (storageAction === "storage-reload")')) + "}";
const selectionStart = source.indexOf("function selectStorageArrangeCard(");
const selectionHandlers = source.slice(selectionStart, source.indexOf('document.addEventListener("dragover"', selectionStart));
const createAction = source.slice(source.indexOf('  if (storageAction === "storage-new-container")'), source.indexOf('  if (storageAction === "storage-new-folder")'));

async function setupPointerFixture(page: Page) {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.setContent(`<section class="storage-center"><section class="storage-browser"><div class="storage-items grid">
    <article class="storage-file-card" data-storage-draggable data-storage-kind="document" data-storage-name="الأول" data-id="a"><h3>الأول</h3><button>عرض المحتوى</button></article>
    <article class="storage-file-card" data-storage-draggable data-storage-kind="document" data-storage-name="الثاني" data-id="b"><h3>الثاني</h3></article>
    <article class="storage-folder-card" data-id="target" data-storage-drop-folder="target" data-storage-folder-system-type="custom"><h3>حاوية</h3></article>
    </div></section></section>`);
  await page.addStyleTag({ content: readFileSync("src/styles/globals.css", "utf8") });
  await page.addScriptTag({ content: `
    const state = { route:"/dashboard/storage", storageSort:"newest", storageCurrentFolderId:"files", storageSearch:"", storageTypeFilter:"all", storageCenter:{storage:{currentFolderId:"files", folders:[{id:"target",name:"حاوية",parentId:"files"}], allFolders:[{id:"target",name:"حاوية",parentId:"files"}], documents:[{id:"a",name:"الأول",type:"custom",folderId:"files"},{id:"b",name:"الثاني",type:"custom",folderId:"files"}],assets:[]}}};
    const escapeHtml = value => String(value || "").replace(/[&<>"']/g, "");
    const dashboardIcon = () => "";
    const closePortal = () => {};
    const toast = () => {};
    const storage = {set:()=>{}};
    window.moves=[]; window.failMove=false;
    const fetchJson = async (url,options) => { window.moves.push({url,body:JSON.parse(options.body)}); if(window.failMove)throw new Error("فشل تجريبي"); };
    const syncRouteData = async () => {};
    ${moveFunctions}
    ${moveActions}
    ${selectionHandlers}
    document.addEventListener("click",event=>{const action=event.target.closest("[data-action]");if(action)void handleAction(action);});
    bindStorageMoveControls();
  ` });
  await page.getByRole("button", { name: "تحريك الملفات والمستندات" }).click();
}

test("real mouse drag starting on the preview button reorders documents and saves the order", async ({ page }) => {
  await setupPointerFixture(page);
  const start = await page.locator('[data-id="a"] button').boundingBox();
  const end = await page.locator('[data-id="b"]').boundingBox();
  expect(start).toBeTruthy(); expect(end).toBeTruthy();
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2);
  await page.mouse.down();
  await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2, { steps: 12 });
  await expect(page.locator('.storage-drag-ghost')).toBeVisible();
  await expect(page.locator('[data-id="b"]')).toHaveClass(/storage-reorder-target/);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (window as any).moves)).toEqual([{ url:"/api/storage/items/reorder", body:{folderId:"files",keys:["document:b","document:a","folder:target"]} }]);
  await expect(page.locator('.storage-drag-ghost')).toHaveCount(0);
  await expect(page.locator('.storage-items>article').first()).toHaveAttribute("data-id", "b");
  // Rebinding simulates the same rendering path used after a refresh.
  await page.evaluate(() => (window as any).eval("bindStorageMoveControls()"));
  await expect(page.locator('.storage-items>article').first()).toHaveAttribute("data-id", "b");
});

test("real touch drag avoids long-press menus and moves a document into a container", async ({ page, context }) => {
  await setupPointerFixture(page);
  const start = await page.locator('[data-id="a"]').boundingBox();
  const end = await page.locator('[data-id="target"]').boundingBox();
  const cdp = await context.newCDPSession(page);
  const point = (box: NonNullable<typeof start>) => ({x:box.x+box.width/2,y:box.y+box.height/2});
  await cdp.send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[point(start!)]});
  await page.waitForTimeout(800);
  const prevented = await page.locator('[data-id="a"]').evaluate(card => !card.dispatchEvent(new MouseEvent("contextmenu", { bubbles:true, cancelable:true })));
  expect(prevented).toBe(true);
  await cdp.send("Input.dispatchTouchEvent", {type:"touchMove",touchPoints:[point(end!)]});
  await expect(page.locator('.storage-drag-ghost')).toBeVisible();
  await expect(page.locator('[data-id="target"]')).toHaveClass(/storage-drop-ready/);
  await cdp.send("Input.dispatchTouchEvent", {type:"touchEnd",touchPoints:[]});
  await expect.poll(() => page.evaluate(() => (window as any).moves)).toEqual([{url:"/api/storage/items/a/move",body:{kind:"document",folderId:"target"}}]);
  await expect(page.locator('.storage-drag-ghost')).toHaveCount(0);
});

test("failed reorder restores the cards, and cancelling a touch leaves no drag overlay", async ({ page, context }) => {
  await setupPointerFixture(page);
  await page.evaluate(() => { (window as any).failMove = true; });
  const start = await page.locator('[data-id="a"]').boundingBox();
  const end = await page.locator('[data-id="b"]').boundingBox();
  await page.mouse.move(start!.x+start!.width/2,start!.y+start!.height/2);
  await page.mouse.down();
  await page.mouse.move(end!.x+end!.width/2,end!.y+end!.height/2,{steps:8});
  await expect(page.locator('.storage-drag-ghost')).toBeVisible();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (window as any).moves.length)).toBe(1);
  await expect(page.locator('.storage-items>article').first()).toHaveAttribute("data-id","a");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:start!.x+30,y:start!.y+40}]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:end!.x+30,y:end!.y+40}]});
  await expect(page.locator('.storage-drag-ghost')).toBeVisible();
  await cdp.send("Input.dispatchTouchEvent",{type:"touchCancel",touchPoints:[]});
  await expect(page.locator('.storage-drag-ghost')).toHaveCount(0);
  await expect(page.locator('.storage-is-dragging')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).moves.length)).toBe(1);
});

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
  await expect(page.locator('.storage-browser')).toHaveClass(/storage-arrange-active/);
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
