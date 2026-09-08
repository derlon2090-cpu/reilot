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

describe("storage center form wiring", () => {
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
  });

  it("loads a complete account usage breakdown only when space management opens", () => {
    expect(actionHandler).toContain('fetchJson("/api/storage/management")');
    expect(source).toContain("كل ما يستهلك المساحة");
    expect(source).toContain("تفصيل كامل محسوب من بيانات الحساب الفعلية");
    expect(managementRoute).toContain("getTenantStorage(auth.session.tenantId)");
    expect(managementRoute).toContain('"Cache-Control": "private, no-store"');
  });
});
