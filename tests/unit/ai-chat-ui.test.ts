import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Renvix Intelligence chat UI", () => {
  it("uses the interface locale without a manual language onboarding step", async () => {
    const source = await readFile("src/app/app.js", "utf8");
    expect(source).not.toContain('data-action="ai-select-language"');
    expect(source).not.toContain("اختر لغتك للبدء");
    expect(source).toContain('locale: state.language === "en" ? "en" : "ar"');
    expect(source).toContain("لغة الشات تتبع لغة الواجهة");
  });

  it("keeps quick actions and support return while storage cleanup lives in account settings", async () => {
    const source = await readFile("src/app/app.js", "utf8");
    expect(source).toContain("العودة إلى مركز الدعم");
    expect(source).toContain('class="rvx-ai-quick-actions"');
    expect(source).not.toContain('data-action="ai-cleanup-storage"');
    expect(source).not.toContain('class="rvx-ai-storage-cleanup"');
    expect(source).toContain("مساحة محادثاتك");
  });
});
