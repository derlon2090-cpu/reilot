import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve("src/app/app.js"), "utf8");
const actionHandler = source.slice(
  source.indexOf("async function handleAction(target)"),
  source.indexOf("async function handleSubmit(form, event)")
);
const submitHandler = source.slice(
  source.indexOf("async function handleSubmit(form, event)"),
  source.indexOf('document.addEventListener("submit"')
);
const managementRoute = readFileSync(resolve("app/api/storage/management/route.js"), "utf8");
const styles = readFileSync(resolve("src/styles/globals.css"), "utf8");

describe("storage center form wiring", () => {
  it("routes storage traffic around the external API rewrite and rejects HTML masquerading as success", () => {
    expect(source).toContain('if (url === "/api/storage") return "/storage-api"');
    expect(source).toContain('url.startsWith("/api/storage/")');
    expect(source).toContain('return "/storage-api/ai-format"');
    expect(source).toContain('error.code = "INVALID_API_RESPONSE"');
  });

  it("keeps button-only trash actions out of the form submit handler", () => {
    expect(actionHandler).toContain('storageAction === "storage-trash-empty"');
    expect(submitHandler).not.toContain("storageAction");
    expect(submitHandler).not.toContain("target.disabled");
  });

  it("submits the folder form to the folder endpoint and restores its label on failure", () => {
    expect(submitHandler).toContain('type === "storage-folder"');
    expect(submitHandler).toContain('fetchJson("/api/storage/folders"');
    expect(submitHandler).toContain('setSubmitBusy(button, false, "إنشاء المجلد")');
  });

  it("creates and opens a rich text document inside the current folder", () => {
    expect(actionHandler).toContain('"storage-create-document"');
    expect(actionHandler).toContain('state.storageComposeType = storageAction === "storage-create-document" ? "custom"');
    expect(source).toContain("عنوان المستند");
    expect(source).toContain("محتوى المستند");
    expect(source).toContain("عرض المحتوى");
    expect(source).toContain("async function openStorageDocument");
    expect(source).toContain('url.searchParams.set("document", documentId)');
    expect(source).toContain('action.dataset.action === "storage-open-document"');
    expect(source).toContain("event.preventDefault()");
    expect(source).toContain("timeoutMs: 10_000");
    expect(source).toContain('storageAction === "storage-retry-document"');
    expect(source).toContain("removeStorageItemFromCurrentView(kind, id)");
    expect(submitHandler).toContain("folderId: data.folderId || undefined");
  });

  it("moves documents to a visible 15-day trash flow", () => {
    expect(actionHandler).toContain("يمكن استعادته خلال 15 يومًا");
    expect(actionHandler).toContain("refreshStorageCenterAfterMutation()");
    expect(source).toContain("تُحذف تلقائيًا بعد 15 يومًا");
    expect(source).toContain("الحذف النهائي خلال");
  });

  it("limits a custom folder to text documents and provides color plus AI formatting tools", () => {
    expect(actionHandler).toContain('currentFolder.systemType === "images"');
    expect(actionHandler).toContain('[["storage-create-document", "مستند نصي"');
    expect(actionHandler).toContain('storageAction === "storage-editor-color"');
    expect(actionHandler).toContain('storageAction === "storage-editor-ai-format"');
    expect(actionHandler).toContain('fetchJson("/api/ai/storage-document/format"');
    expect(source).toContain("ترتيب النص بالذكاء الاصطناعي");
    expect(source).toContain("ألوان النص");
    expect(actionHandler).toContain("payload.fallback");
    expect(actionHandler).toContain("syncAIQuota(payload)");
    expect(actionHandler).toContain("توكن من رصيد الشات");
    expect(styles).toContain(".storage-editor-body{min-height:330px;padding:22px;outline:none;font-size:14px;font-weight:400");
  });

  it("persists a per-document countdown and marks expired document cards in red", () => {
    expect(source).toContain('storageAction === "storage-editor-timer"');
    expect(source).toContain('type === "storage-document-timer"');
    expect(source).toContain("timerEndsAt: form.dataset.timerEndsAt || null");
    expect(source).toContain('data-storage-countdown data-expires-at=');
    expect(source).toContain("انتهى التوقيت");
    expect(source).toContain("window.setInterval(update, 1000)");
    expect(styles).toContain(".storage-document-card.is-timer-expired");
    expect(styles).toContain(".storage-editor-toolbar .storage-editor-timer");
    expect(styles).toContain(".storage-timer-form");
  });

  it("lets timers over 24 hours use days or total-hours display consistently", () => {
    expect(source).toContain("طريقة عرض المدة");
    expect(source).toContain("أيام وساعات");
    expect(source).toContain("إجمالي الساعات");
    expect(source).toContain("function storageTimerDurationText");
    expect(source).toContain('data-display-mode="${timer.displayMode}"');
    expect(source).toContain("timerDisplayMode: form.dataset.timerDisplayMode === \"hours\" ? \"hours\" : \"days\"");
    expect(styles).toContain(".storage-timer-display");
    expect(styles).toContain(".storage-timer-preview");
  });

  it("keeps the current editor draft through rerenders and animates its focus state", () => {
    expect(source).toContain("state.storageDocumentDraft = null");
    expect(source).toContain("function syncStorageDocumentDraft");
    expect(source).toContain("body: editor.innerHTML");
    expect(source).toContain("function restoreStorageDocumentDraft");
    expect(source).toContain("editor.innerHTML = draft.body");
    expect(source).toContain('if (state.route === "/dashboard/storage") restoreStorageDocumentDraft()');
    expect(styles).toContain(".storage-editor:focus-within");
    expect(styles).toContain("@keyframes storage-editor-focus-line");
  });

  it("preserves text selection and persists bold formatting as an editor change", () => {
    expect(source).toContain("function captureStorageEditorSelection");
    expect(source).toContain("function restoreStorageEditorSelection");
    expect(source).toContain("function applyStorageEditorCommand");
    expect(source).toContain("function normalizeStorageBoldMarkup");
    expect(source).toContain('setAttribute("data-storage-bold", "true")');
    expect(source).toContain('inputTypes = { bold: "formatBold"');
    expect(source).toContain('new InputEvent("input", { bubbles: true, inputType })');
    expect(source).toContain('document.addEventListener("mousedown"');
    expect(source).toContain('document.addEventListener("pointerdown"');
    expect(source).toContain('document.addEventListener("selectionchange"');
    expect(styles).toContain(".storage-editor-toolbar button.is-active");
    expect(styles).toContain('[data-storage-bold="true"]');
    expect(styles).toContain("font-weight:800!important");
  });

  it("loads a complete account usage breakdown only when space management opens", () => {
    expect(actionHandler).toContain('fetchJson("/api/storage/management")');
    expect(source).toContain("كل ما يستهلك المساحة");
    expect(source).toContain("تفصيل كامل محسوب من بيانات الحساب الفعلية");
    expect(managementRoute).toContain("getTenantStorage(auth.session.tenantId)");
    expect(managementRoute).toContain('"Cache-Control": "private, no-store"');
  });
});
