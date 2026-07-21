import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");

describe("templates catalog UI", () => {
  it("routes the user dashboard to the rebuilt templates catalog", () => {
    expect(appSource).toContain('"/dashboard/templates": templatesCatalogPage');
    expect(appSource).toContain('"/dashboard/renewal-template": "/dashboard/templates"');
    expect(appSource).toContain("function templatesCatalogPage()");
  });

  it("combines persisted renewal and Salla order templates without sample data", () => {
    expect(appSource).toContain("state.notificationTemplate?.templates");
    expect(appSource).toContain("state.orderLinkTemplates");
    expect(appSource).toContain('loadRemotePage("orderLinkTemplates", "/api/order-information/template"');
    expect(appSource).not.toContain("const fakeTemplates");
    expect(appSource).not.toContain("const sampleEmailValue");
  });

  it("uses the new card grid and channel-specific editors", () => {
    expect(appSource).toContain('class="template-catalog-grid"');
    expect(appSource).toContain('class="template-catalog-card"');
    expect(appSource).toContain("function renewalTemplateEditorPageV2");
    expect(appSource).toContain('class="whatsapp-phone-preview"');
    expect(appSource).toContain("email-preview-v2");
    expect(stylesSource).toContain(".template-editor-v2-whatsapp");
    expect(stylesSource).toContain(".template-editor-v2-email");
  });
});
