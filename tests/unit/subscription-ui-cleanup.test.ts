import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const appSource = await readFile("src/app/app.js", "utf8");
const publicAppSource = await readFile("public/app/app.js", "utf8");
const stylesSource = await readFile("src/styles/globals.css", "utf8");
const publicStylesSource = await readFile("public/app/styles/globals.css", "utf8");

const renewalEditorSource = appSource.slice(
  appSource.indexOf("function renewalTemplateEditorPageV2("),
  appSource.indexOf("function templateEditorField(")
);

describe("subscription workspace cleanup", () => {
  it("renders server filters only on the subscription list", () => {
    const conditionalToolbar = '${state.subscriptionSection === "list" ? subscriptionToolbar() : ""}';

    expect(appSource).toContain(conditionalToolbar);
    expect(publicAppSource).toContain(conditionalToolbar);
  });

  it("keeps the removed renewal controls out of the visible editor without resetting their values", () => {
    expect(renewalEditorSource).toContain("const preservedReminderSettings");
    expect(renewalEditorSource).toContain('type="hidden" name="daysOffset"');
    expect(renewalEditorSource).toContain('type="hidden" name="isActive"');
    expect(renewalEditorSource).not.toContain("const reminderSettings");
    expect(renewalEditorSource).not.toContain("template-settings-grid");
  });

  it("uses readable support text and comfortable reminder settings spacing", () => {
    for (const styles of [stylesSource, publicStylesSource]) {
      expect(styles).toContain(".subscription-settings-panel { padding: 28px; }");
      expect(styles).toContain(".dashboard-main .subscription-settings-panel{padding:28px}");
      expect(styles).toContain(".subscription-settings-panel > .section-head { margin-bottom: 22px; }");
      expect(styles).toMatch(/\.sidebar-support-link \{[\s\S]*?color: #fff;/);
      expect(styles).toContain(".subscription-settings-form>.message-activation-card{grid-column:1/-1;margin:0 0 4px;padding:16px 18px}");
    }
  });
});
