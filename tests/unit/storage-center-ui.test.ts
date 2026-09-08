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
    expect(submitHandler).toContain("folderId: data.folderId || undefined");
  });

  it("loads a complete account usage breakdown only when space management opens", () => {
    expect(actionHandler).toContain('fetchJson("/api/storage/management")');
    expect(source).toContain("كل ما يستهلك المساحة");
    expect(source).toContain("تفصيل كامل محسوب من بيانات الحساب الفعلية");
    expect(managementRoute).toContain("getTenantStorage(auth.session.tenantId)");
    expect(managementRoute).toContain('"Cache-Control": "private, no-store"');
  });
});
