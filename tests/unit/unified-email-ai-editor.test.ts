import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../drizzle/0088_email_template_ai_generation.sql", import.meta.url), "utf8");
const catalogRoute = readFileSync(new URL("../../app/api/templates/catalog/route.js", import.meta.url), "utf8");
const sallaRoute = readFileSync(new URL("../../app/api/admin/integrations/salla/templates/route.js", import.meta.url), "utf8");

function between(start: string, end: string) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return app.slice(from, to);
}

describe("unified email AI editor", () => {
  it("is reused by renewal, order delivery, and every Salla email template context", () => {
    expect(app).toContain("function emailTemplateAIBuilderMarkup");
    expect(app).toContain('templateType: "renewal"');
    expect(app).toContain('templateType: "email_delivery"');
    expect(app).toContain("templateType: `salla:${item.templateKey}`");
  });

  it("keeps draft, approval, editor, and save as separate user actions", () => {
    expect(app).toContain("إنشاء مسودة");
    expect(app).toContain("اعتماد المسودة في المحرر؟");
    expect(app).toContain("لن يتم حفظ القالب أو إرساله تلقائيًا");
    expect(app).toContain('data-action="email-ai-undo"');
  });

  it("supports all requested modes and isolated before/after previews", () => {
    for (const mode of ["generate", "edit", "replace", "improve", "fix"]) expect(app).toContain(`["${mode}"`);
    expect(app).toContain('class="renewal-email-ai-result-preview email-ai-compare');
    expect(app).toContain('sandbox="" referrerpolicy="no-referrer"');
  });

  it("debounces the live code preview and has responsive desktop, tablet, and mobile layouts", () => {
    expect(app).toContain("}, 340);");
    expect(styles).toContain(".email-code-workspace");
    expect(styles).toContain("@media (max-width:1120px)");
    expect(styles).toContain("@media (max-width:760px)");
    expect(styles).toContain("@media (max-width:460px)");
  });

  it("records distinct task types without storing raw prompts", () => {
    expect(migration).toContain("email_template_code_replace");
    expect(migration).toContain("email_template_code_improve");
    expect(migration).toContain("email_template_code_fix");
    expect(migration).toContain("email_template_suggestions");
    expect(migration).toContain("prompt_sha256");
  });

  it("charges only generation or suggestions, never preview, approval, undo, validation, manual edit, or save", () => {
    const applyDraft = between("function applyEmailAIDraft", "function readEmailTemplateForm");
    const validator = between("function inspectEmailHtmlClient", "function emailDesignBuilder");
    const preview = between('if (action === "email-ai-preview-result")', 'if (action === "email-ai-copy")');
    const undo = between('if (action === "email-ai-undo")', 'if (action === "email-code-copy")');
    for (const source of [applyDraft, validator, preview, undo, catalogRoute, sallaRoute]) {
      expect(source).not.toContain("reserveAITokens");
      expect(source).not.toContain("settleAITokenReservation");
      expect(source).not.toContain("/api/ai/");
    }
    // One endpoint is shared by the template editor and the campaign studio;
    // both are explicit generation actions and both settle provider usage.
    expect(app.match(/\/api\/ai\/email-template\/generate/g)).toHaveLength(2);
    expect(app.match(/\/api\/ai\/email-template\/suggestions/g)).toHaveLength(1);
    expect(app).toContain('data-action="email-ai-regenerate"');
  });
});
