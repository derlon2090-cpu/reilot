import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/app.js", "utf8");
const helpers = source.slice(source.indexOf("function syncStorageDocumentDraft("), source.indexOf("function restoreStorageDocumentDraft("));
const composer = source.slice(source.indexOf("function storageDocumentComposer("), source.indexOf("function storageDocumentView("));

for (const type of ["custom", "note", "account", "code"]) {
  test(`Enter in ${type} title focuses content without undo or submission`, async ({ page }) => {
    await page.setContent('<main id="fixture"></main>');
    await page.addScriptTag({ content: `
      const state = { storageComposeType: "${type}", storageEditingDocument: null };
      const escapeHtml = value => String(value || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
      const dashboardShell = html => html;
      const dashboardIcon = () => "";
      const storageBreadcrumbs = () => "";
      const normalizeStorageTimerDisplayMode = () => "days";
      const storageFolderOptions = () => '<option value="files">الملفات</option>';
      ${composer}
      document.querySelector("#fixture").innerHTML = storageDocumentComposer({});
      ${helpers}
      window.submissions = 0; window.commands = 0;
      document.addEventListener("submit", event => { event.preventDefault(); window.submissions++; });
      document.addEventListener("click", event => { if(event.target.closest('[data-action="storage-editor-command"]')) window.commands++; });
      window.getDraft = () => state.storageDocumentDraft;
    ` });
    const title = page.locator('input[name="title"]');
    const editor = page.locator("[data-storage-editor]");
    if (await editor.count()) await editor.fill("نص موجود");
    await title.fill("عنوان جديد");
    await title.press("Enter");
    await expect(title).toHaveValue("عنوان جديد");
    const destination = type === "account" ? page.locator('input[name="email"]') : type === "code" ? page.locator('textarea[name="code"]') : editor;
    await expect(destination).toBeFocused();
    expect(await page.evaluate(() => [(window as any).submissions, (window as any).commands])).toEqual([0, 0]);
    if (await editor.count()) {
      await expect(editor).toHaveText("نص موجود");
      expect(await page.evaluate(() => (window as any).getDraft().title)).toBe("عنوان جديد");
      await page.keyboard.type(" محفوظ");
      await expect(editor).toHaveText("نص موجود محفوظ");
      await page.keyboard.press("Enter");
      await page.keyboard.type("سطر جديد");
      await expect(editor).toContainText("سطر جديد");
      expect(await editor.innerHTML()).toMatch(/<div>|<br>/);
      await title.focus();
      const prevented = await title.evaluate(input => !input.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter",isComposing:true,bubbles:true,cancelable:true})));
      expect(prevented).toBe(false);
      await expect(title).toBeFocused();
    }
  });
}
