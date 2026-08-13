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

  it("keeps quick actions, support return, and cleanup controls in the chat shell", async () => {
    const source = await readFile("src/app/app.js", "utf8");
    expect(source).toContain("العودة إلى مركز الدعم");
    expect(source).toContain('class="rvx-ai-quick-actions"');
    expect(source).toContain('data-action="ai-cleanup-storage"');
    expect(source).toContain("قد تُحذف بعض بياناتك المهمة");
  });
});
