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
});
