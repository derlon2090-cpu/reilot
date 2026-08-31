import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const renewalEditorSource = appSource.slice(
  appSource.indexOf("function renewalTemplateEditorPageV2("),
  appSource.indexOf("function renewalTemplateEditorPage(")
);
const renewalEmailStart = renewalEditorSource.indexOf('const variables = ["{{customer_name}}"');
const renewalWhatsappSource = renewalEditorSource.slice(0, renewalEmailStart);
const renewalEmailSource = renewalEditorSource.slice(renewalEmailStart);

describe("templates catalog UI", () => {
  it("routes the user dashboard to the rebuilt templates catalog", () => {
    expect(appSource).toContain('"/dashboard/templates": templatesCatalogPage');
    expect(appSource).toContain('"/dashboard/renewal-template": "/dashboard/templates"');
    expect(appSource).toContain("function templatesCatalogPage()");
  });

  it("loads the general templates, renewal email, and an approved Meta template without Salla fulfillment", () => {
    expect(appSource).toContain('loadRemotePage("catalogTemplates", "/api/templates/catalog"');
    expect(appSource).not.toContain('email_delivery: { channel: "email", name: "قالب البريد الإلكتروني"');
    expect(appSource).toContain("renewal_whatsapp");
    expect(appSource).toContain('key: "renewal_email"');
    expect(appSource).toContain('editorKey === "renewal_email"');
    expect(appSource).toContain("قالب رسالة التجديد - البريد الإلكتروني");
    expect(appSource).toContain("subscription_renewal_reminder");
    expect(appSource).toContain('pageTitle("قوالب عامة"');
    expect(appSource).toContain('const pageActions = title === "قوالب عامة" ? "" : actions');
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
    expect(appSource).toContain('class="whatsapp-phone-preview');
    expect(appSource).toContain("email-preview-v2");
    expect(appSource).toContain("storeLogoEditor(state.orderLinkProfile?.logoUrl)");
    expect(stylesSource).toContain(".general-template-card");
    expect(stylesSource).toContain(".meta-approved-editor");
    expect(stylesSource).toContain(".template-editor-v2-whatsapp");
    expect(stylesSource).toContain(".template-editor-v2-email");
    expect(stylesSource).toContain(".template-editor-v2-email > * { direction: rtl;");
    expect(stylesSource).toContain(".store-logo-editor");
    expect(appSource).toContain("function emailDesignBuilder");
    expect(appSource).toContain('data-action="adopt-email-html"');
    expect(appSource).toContain('name="emailContentMode"');
    expect(stylesSource).toContain(".email-builder-form");
    expect(stylesSource).toContain(".email-design-presets");
    expect(stylesSource).toContain(".email-template-theme");
    expect(stylesSource).toContain(".email-envelope.design-editorial");
    expect(stylesSource).toContain(".email-envelope.design-aurora");
  });

  it("keeps the renewal WhatsApp editor dedicated to WhatsApp with a light preview", () => {
    expect(renewalWhatsappSource).toContain('pageTitle("قالب رسالة التجديد - واتساب", backButton)');
    expect(renewalWhatsappSource).toContain('<input type="hidden" name="channel" value="whatsapp">');
    expect(renewalWhatsappSource).not.toContain("${channelSelect}");
    expect(renewalWhatsappSource).toContain('class="whatsapp-phone-preview renewal-whatsapp-phone-preview"');
    expect(stylesSource).toContain(".renewal-whatsapp-phone-preview { border: 1px solid #E8F1F0; background: #fff; }");
    expect(stylesSource).toContain(".renewal-whatsapp-phone-preview .whatsapp-phone-shell");
  });

  it("rebuilds the renewal email editor as the reference-matched studio", () => {
    expect(renewalEmailSource).toContain('pageTitle("قالب رسالة التجديد - البريد الإلكتروني", backButton)');
    expect(renewalEmailSource).toContain('<input type="hidden" name="channel" value="email">');
    expect(renewalEmailSource).not.toContain("${channelSelect}");
    expect(renewalEmailSource).toContain('class="email-builder-form renewal-email-builder"');
    expect(renewalEmailSource).toContain('class="renewal-email-main"');
    expect(renewalEmailSource).toContain('class="renewal-email-message-panel"');
    expect(renewalEmailSource).toContain('class="renewal-email-browser"');
    expect(renewalEmailSource).toContain('name="templateDescription"');
    expect(renewalEmailSource).toContain('{{support_url}}');
    expect(renewalEmailSource).toContain('templateType: "renewal"');
    expect(stylesSource).toContain(".renewal-email-builder { display: grid;");
    expect(stylesSource).toContain(".renewal-email-utility-grid { display: grid;");
    expect(stylesSource).toContain(".renewal-email-preview-column { position: sticky;");
  });
});
