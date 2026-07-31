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

  it("loads the general templates, renewal email, and an approved Meta template without Salla fulfillment", () => {
    expect(appSource).toContain('loadRemotePage("catalogTemplates", "/api/templates/catalog"');
    expect(appSource).toContain("email_delivery");
    expect(appSource).toContain("renewal_whatsapp");
    expect(appSource).toContain('key: "renewal_email"');
    expect(appSource).toContain('editorKey === "renewal_email"');
    expect(appSource).toContain("قالب رسالة التجديد - البريد الإلكتروني");
    expect(appSource).toContain("subscription_renewal_reminder");
    expect(appSource).toContain('pageTitle("قوالب عامة"');
    expect(appSource).not.toContain("سيتم إنشاء القوالب الأربعة الأساسية لمساحة العمل تلقائيًا");
    expect(appSource).not.toContain('key: `order_${item.id}`');
    expect(appSource).not.toContain("const fakeTemplates");
    expect(appSource).not.toContain("const sampleEmailValue");
  });

  it("uses the exact general list and server-backed Meta template controls", () => {
    expect(appSource).toContain('class="general-templates-list"');
    expect(appSource).toContain('class="general-template-card"');
    expect(appSource).toContain('data-action="meta-template-sync"');
    expect(appSource).toContain('data-action="meta-template-delete"');
    expect(appSource).toContain("حذف القالب من Meta قد يمنع استخدامه");
    expect(appSource).toContain("function renewalTemplateEditorPageV2");
    expect(appSource).toContain("function catalogTemplateEditorPage");
    expect(appSource).toContain('class="whatsapp-phone-preview"');
    expect(appSource).toContain("email-preview-v2");
    expect(appSource).toContain("storeLogoEditor(state.orderLinkProfile?.logoUrl)");
    expect(stylesSource).toContain(".general-template-card");
    expect(stylesSource).toContain(".meta-approved-editor");
    expect(stylesSource).toContain(".template-editor-v2-whatsapp");
    expect(stylesSource).toContain(".template-editor-v2-email");
    expect(stylesSource).toContain(".template-editor-v2-email > * { direction: rtl;");
    expect(stylesSource).toContain(".store-logo-editor");
  });
});
