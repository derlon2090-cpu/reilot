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

  it("loads the four persisted catalog templates without mixing in order information", () => {
    expect(appSource).toContain('loadRemotePage("catalogTemplates", "/api/templates/catalog"');
    expect(appSource).toContain("whatsapp_menu");
    expect(appSource).toContain("email_delivery");
    expect(appSource).toContain("renewal_whatsapp");
    expect(appSource).toContain("salla_fulfilled");
    expect(appSource).toContain("قالب تم التنفيذ — سلة");
    expect(appSource).not.toContain('key: `order_${item.id}`');
    expect(appSource).not.toContain("const fakeTemplates");
    expect(appSource).not.toContain("const sampleEmailValue");
  });

  it("uses the new card grid and channel-specific editors", () => {
    expect(appSource).toContain('class="template-catalog-grid"');
    expect(appSource).toContain('class="template-catalog-card"');
    expect(appSource).toContain("function renewalTemplateEditorPageV2");
    expect(appSource).toContain("function catalogTemplateEditorPage");
    expect(appSource).toContain('class="whatsapp-phone-preview"');
    expect(appSource).toContain("email-preview-v2");
    expect(appSource).toContain("catalog-salla-previews");
    expect(appSource).toContain("whatsapp-opened-list");
    expect(stylesSource).toContain(".template-editor-v2-whatsapp");
    expect(stylesSource).toContain(".template-editor-v2-email");
    expect(stylesSource).toContain(".template-editor-v2-salla");
  });
});
