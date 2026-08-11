import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SALLA_TEMPLATE_DEFINITIONS,
  SALLA_TEMPLATE_KEYS,
  normalizeSallaTemplateEvent,
  paidDigitalDelivery,
  previewSallaAutomationTemplate,
  renderSallaTemplate,
  resolveSallaChannelContent
} from "../../src/server/salla-templates.js";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/app.js"), "utf8");
const adminCatalogSource = fs.readFileSync(path.resolve(process.cwd(), "src/components/admin/AdminSallaCatalog.jsx"), "utf8");
const styles = fs.readFileSync(path.resolve(process.cwd(), "src/styles/globals.css"), "utf8");
const serverSource = fs.readFileSync(path.resolve(process.cwd(), "src/server/salla-templates.js"), "utf8");
const resendSource = fs.readFileSync(path.resolve(process.cwd(), "src/server/email/resend.service.js"), "utf8");
const metaSource = fs.readFileSync(path.resolve(process.cwd(), "src/server/meta-interactive-service.js"), "utf8");
const cronSource = fs.readFileSync(path.resolve(process.cwd(), "src/server/cron-runner.js"), "utf8");
const testRouteSource = fs.readFileSync(path.resolve(process.cwd(), "app/api/apps/salla/templates/[templateKey]/test/route.js"), "utf8");
const digitalLinkDefaultOffMigration = fs.readFileSync(path.resolve(process.cwd(), "drizzle/0069_disable_digital_delivery_link_by_default.sql"), "utf8");

describe("Salla automation templates", () => {
  it("defines exactly one immutable record key for every required template", () => {
    const keys = SALLA_TEMPLATE_DEFINITIONS.map((item) => item.key);
    expect(keys).toHaveLength(12);
    expect(new Set(keys).size).toBe(12);
    expect(keys).toEqual(expect.arrayContaining(Object.values(SALLA_TEMPLATE_KEYS)));
  });

  it("keeps completion as a secure order-link message and preserves the invoice link path", () => {
    const completed = SALLA_TEMPLATE_DEFINITIONS.find((item) => item.key === SALLA_TEMPLATE_KEYS.COMPLETED);
    expect(completed?.triggerType).toBe("order_status");
    expect(completed?.body).toContain("{{order_url}}");
    expect(serverSource).toContain('key: "salla_invoice_ready"');
    expect(serverSource).toContain('? "invoice"');
  });

  it("normalizes tenant-neutral identifiers from a Salla event", () => {
    const event = normalizeSallaTemplateEvent({
      id: "evt-1",
      event: "order.status.updated",
      merchant: 991,
      data: {
        id: 440,
        status: { id: 7, slug: "shipped" }
      }
    });
    expect(event).toMatchObject({
      externalEventId: "evt-1",
      eventName: "order.status.updated",
      storeId: "991",
      orderId: "440",
      statusId: "7",
      statusSlug: "shipped"
    });
    expect(event).not.toHaveProperty("tenantId");
  });

  it("renders only supplied values and strips unresolved whitespace", () => {
    const rendered = renderSallaTemplate(
      "مرحبًا {{customer_name}}\n\n{{tracking_number}}\n\nشكرًا",
      { customer_name: "وليد" }
    );
    expect(rendered).toContain("وليد");
    expect(rendered).not.toContain("{{customer_name}}");
    expect(rendered).not.toContain("{{tracking_number}}");
  });

  it("marks preview output as non-delivery data", () => {
    const preview = previewSallaAutomationTemplate({
      channel: "whatsapp",
      messageBody: "مرحبًا {{customer_name}}",
      emailSubject: null
    });
    expect(preview.body).toContain("أحمد");
    expect(preview.notice).toContain("معاينة فقط");
  });

  it("uses one activation control with a specific message title for every Salla template", () => {
    for (const definition of SALLA_TEMPLATE_DEFINITIONS) {
      expect(appSource).toContain(`${definition.key}: "تفعيل رسالة`);
    }
    expect(appSource).toContain('action: "salla-template-toggle"');
    expect(appSource).toContain("عند الإيقاف لن تُرسل الرسالة");
    expect(styles).toContain(".message-activation-card{min-height:66px");
    expect(styles).toContain(".message-activation-switch");
  });

  it("excludes disabled templates in the database query before any message is queued", () => {
    expect(serverSource).toContain("WHERE tenant_id=$1 AND is_enabled=true");
    expect(serverSource).toContain('reason: "template_disabled_or_unmapped"');
  });

  it("keeps an independent persisted delivery channel for every template", () => {
    expect(serverSource).toContain('delivery_channel AS channel');
    expect(serverSource).toContain('WHERE tenant_id=$1 AND template_key=$2');
    expect(serverSource).toContain('delivery_channel=$3');
    expect(appSource).toContain('name="channel" value="email" data-salla-channel-choice');
    expect(appSource.indexOf('name="channel" value="email" data-salla-channel-choice')).toBeLessThan(
      appSource.indexOf('name="channel" value="whatsapp" data-salla-channel-choice')
    );
    expect(appSource).toContain('const selectedChannel = item.channel || "whatsapp";');
  });

  it("updates the preview immediately when a template channel changes", () => {
    expect(appSource).toContain("function refreshSallaTemplatePreview");
    expect(appSource).toContain('data-salla-preview-head="whatsapp"');
    expect(appSource).toContain('data-salla-preview-head="email"');
    expect(appSource).toContain("refreshSallaTemplatePreview(form)");
  });

  it("stretches every Salla preview beside its form with contextual guidance", () => {
    expect(appSource).toContain("SALLA_TEMPLATE_PREVIEW_GUIDANCE");
    expect(appSource).toContain('class="salla-template-preview-sticky"');
    expect(appSource).toContain('class="salla-template-preview-stack"');
    expect(appSource).toContain('class="salla-preview-important-note" role="note"');
    expect(appSource).toContain("تأكد من اتصال جهاز واتساب قبل تفعيل الإرسال التلقائي.");
    expect(appSource).toContain("تأكد من اعتماد بريد المرسل قبل تفعيل الإرسال التلقائي.");
    expect(appSource).toContain('data-salla-preview-channel-readiness');
    expect(appSource).toContain('isDigitalDelivery ? "" : `<section class="salla-preview-important-note"');
    expect(appSource).toContain('<form id="salla-template-editor-form" class="salla-template-editor-form"');
    expect(appSource).toContain('<div class="salla-template-editor-layout">');
    expect(appSource).not.toContain('<section class="salla-template-editor-layout">');
    expect(styles).toContain(".salla-template-editor-form{display:grid;grid-template-rows:max-content max-content;align-content:start;align-self:start;height:max-content;gap:12px;margin:0");
    expect(styles).toContain(".salla-template-editor-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(360px,.86fr);gap:20px;align-items:stretch;align-content:start;align-self:start");
    expect(styles).toContain(".salla-template-form-card{grid-column:1;grid-row:1");
    expect(styles).toContain(".salla-template-live-preview{grid-column:2;grid-row:1}");
    expect(styles).not.toContain(".salla-editor-actions{grid-column:1;grid-row:2}");
    expect(styles).toContain(".salla-template-live-preview{position:relative;align-self:stretch;height:auto;min-height:0;padding:18px;overflow:visible;contain:size");
    expect(styles).not.toContain(".salla-template-live-preview{position:relative;align-self:stretch;height:100%;min-height:100%");
    expect(styles).toContain(".salla-template-preview-sticky{position:sticky;top:92px");
    expect(styles).toContain('[data-theme="dark"] .salla-preview-important-note');
    expect(styles).toContain(".salla-template-live-preview.is-digital-delivery .salla-template-preview-stack:has(.salla-digital-link-preview:not([hidden]))");
    expect(styles).toContain("grid-template-rows:repeat(2,minmax(0,1fr))");
    expect(styles).toContain("align-content:stretch;gap:32px");
    expect(styles).toContain("animation:sallaDigitalPagePreviewIn .52s cubic-bezier(.22,1,.36,1) both");
    expect(styles).toContain("@keyframes sallaDigitalPagePreviewIn");
  });

  it("keeps Salla header icons compact and uses a roomy white WhatsApp phone preview", () => {
    expect(appSource).toContain('class="salla-whatsapp-phone-header"');
    expect(appSource).toContain('class="salla-whatsapp-phone-avatar"');
    expect(appSource).toContain('class="salla-whatsapp-phone-composer"');
    expect(styles).toContain(".salla-template-editor-layout .section-head>svg{width:24px!important;height:24px!important;min-width:24px!important;max-width:24px!important");
    expect(styles).toContain(".salla-whatsapp-preview-canvas{position:relative;width:100%;max-width:520px;min-height:580px");
    expect(styles).toContain("border:7px solid #0B3F3B;border-radius:36px;background:#fff");
    expect(styles).toContain(".salla-whatsapp-phone-composer{");
  });

  it("places three professional Salla email designs below the image with an adjacent color editor", () => {
    const customerEmailPanel = appSource.slice(
      appSource.indexOf("const emailPanel ="),
      appSource.indexOf("const abandoned =", appSource.indexOf("const emailPanel ="))
    );
    expect(appSource).toContain('name="whatsappImageEnabled"');
    expect(appSource).toContain('data-salla-whatsapp-image');
    expect(appSource).toContain('data-salla-whatsapp-image-editor');
    expect(appSource).toContain('data-action="salla-whatsapp-image-file"');
    expect(appSource).toContain('action === "choose-salla-whatsapp-image"');
    expect(appSource).toContain('whatsappImageEditor?.toggleAttribute("hidden", !imageEnabled)');
    expect(appSource).toContain('target.name === "whatsappImageEnabled"');
    expect(appSource).toContain('editor?.toggleAttribute("hidden", !target.checked)');
    expect(appSource).toContain('whatsappImageUrl: payload.imageUrl');
    expect(appSource).toContain('/api/apps/salla/templates/${encodeURIComponent(templateKey)}/image');
    expect(appSource).not.toContain('refreshSallaTemplatePreview(form, { logoUrl: payload.logoUrl, whatsappImageUrl: payload.logoUrl })');
    expect(appSource).toContain('name="emailDesign"');
    expect(appSource).toContain('const SALLA_EMAIL_DESIGN_IDS = ["editorial", "commerce", "executive"]');
    expect(appSource).toContain('presetIds: SALLA_EMAIL_DESIGN_IDS');
    expect(appSource).toContain('{ id: "editorial"');
    expect(appSource).toContain('{ id: "commerce"');
    expect(appSource).toContain('{ id: "executive"');
    expect(appSource).toContain('name="emailThemeColor"');
    expect(appSource).toContain('data-action="set-email-theme-color"');
    expect(appSource).toContain('class="email-design-workspace"');
    expect(appSource).toContain("تعديل لون القالب");
    expect(appSource).toContain('<h2>تصميم البريد</h2>');
    expect(customerEmailPanel.indexOf("${sallaEmailLogoEditor}")).toBeLessThan(customerEmailPanel.indexOf("${sallaEmailDesignSection}"));
    expect(adminCatalogSource.indexOf("data-admin-salla-email-image-section")).toBeLessThan(adminCatalogSource.indexOf("data-admin-salla-email-design-section"));
    expect(styles).toContain(".salla-email-design-section { display: grid; gap: 12px;");
    expect(styles).toContain(".email-design-builder.is-salla-catalog .email-design-workspace { grid-template-columns:");
    expect(appSource).toContain('data-action="adopt-email-design"');
    expect(appSource).toContain('data-action="adopt-email-html"');
    expect(appSource).toContain('name="emailHtmlContent"');
    expect(appSource).toContain('name="emailContentMode"');
    expect(serverSource).toContain("whatsappImageEnabled");
    expect(serverSource).toContain("emailDesign");
    expect(serverSource).toContain("emailContentMode");
    expect(serverSource).toContain("emailThemeColor");
    expect(serverSource).toContain("inspectCustomEmailHtml");
    expect(resendSource).toContain("function designedEmailBody");
    expect(resendSource).toContain("editorial:");
    expect(resendSource).toContain("aurora:");
    expect(resendSource).toContain("customInspection?.ok ? customInspection.html : designedBody");
    expect(metaSource).toContain("export async function sendMetaImageMessage");
    expect(metaSource).toContain('type: "image"');
    expect(cronSource).toContain("item.template_snapshot?.whatsappImageEnabled");
  });

  it("caps review and abandoned-cart scheduling at 48 hours", () => {
    expect(appSource).toContain('name="reviewTriggerStatus"');
    expect(appSource).toContain('name="reviewDelayHours"');
    expect(appSource).toContain('name="abandonedDelayHours"');
    expect(appSource).toContain('max="48"');
    expect(appSource).toContain("يتم إرسال رسالة طلب التقييم عند الحالة");
    expect(appSource).toContain('option value="shipped"');
    expect(appSource).toContain('option value="delivered"');
    expect(appSource).toContain('option value="completed"');
    expect(serverSource).toContain("Math.min(2880");
    expect(serverSource).toContain("settings->>'reviewTriggerStatus'");
    expect(serverSource).toContain("template_key<>'review_request'");
    expect(serverSource).toContain("item.templateKey !== SALLA_TEMPLATE_KEYS.REVIEW_REQUEST");
    expect(serverSource).toContain("scheduled_for=now()+($2::text || ' minutes')::interval");
  });

  it("offers three persisted digital delivery page designs", () => {
    expect(appSource).toContain('class="salla-link-options" data-salla-link-options');
    expect(appSource).toContain("خيارات الرابط");
    expect(appSource).toContain("تصميم صفحة التسليم");
    expect(appSource).toContain('name="deliveryPageDesign"');
    expect(appSource).toContain('value="cards"');
    expect(appSource).toContain('value="compact"');
    expect(appSource).toContain('name="deliveryPageCustomCss"');
    expect(appSource).toContain("كود تصميم صفحة الرابط (CSS آمن) — اختياري");
    expect(appSource).toContain("normalizeSallaPageCssCode");
    expect(serverSource).toContain("deliveryPageDesign");
    expect(serverSource).toContain("customCssCode: normalizeSallaPageCssCode");
    expect(styles).toContain(".salla-public-page.design-cards");
    expect(styles).toContain(".salla-public-page.design-compact");
  });

  it("places the apps return action on the upper left and shows persisted update time", () => {
    expect(appSource).toContain('class="salla-template-editor-top"><button class="btn btn-secondary" data-link="/dashboard/apps"');
    expect(appSource).toContain("العودة إلى التطبيقات");
    expect(appSource).toContain('class="salla-template-updated-at"');
    expect(appSource).toContain('toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })');
  });

  it("persists independent content for WhatsApp and email", () => {
    expect(serverSource).toContain('whatsapp_content AS "whatsappContent"');
    expect(serverSource).toContain('email_text_content AS "emailTextContent"');
    expect(serverSource).toContain("whatsapp_content=$11");
    expect(serverSource).toContain("email_text_content=$12");
    expect(appSource).toContain('name="whatsappContent"');
    expect(appSource).toContain('name="emailTextContent"');
  });

  it("requires a real completed transition and rejects stale status events", () => {
    expect(serverSource).toContain("claimCompletedTransition");
    expect(serverSource).toContain("recordObservedOrderStatus");
    expect(serverSource).toContain("not_a_new_transition");
    expect(serverSource).toContain("extractTrustedDeliveryContent");
    expect(serverSource).toContain("claimSallaEventWatermark");
    expect(serverSource).toContain("latest_event_at<=EXCLUDED.latest_event_at");
  });

  it("fetches the dedicated order-items endpoint when order details omit items", () => {
    expect(serverSource).toContain("/orders/${encodeURIComponent(orderId)}/items");
    expect(serverSource).toContain("Array.isArray(detail?.items) && detail.items.length");
  });

  it.each([
    ["unpaid", { payment: { status: "pending" }, urls: { digital_content: "https://cdn.example.test/file" } }, false, 1],
    ["processing", { payment: { status: "processing" }, urls: { digital_content: "https://cdn.example.test/file" } }, false, 1],
    ["missing link", { payment: { status: "paid" } }, true, 0],
    ["insecure link", { payment: { status: "paid" }, urls: { digital_content: "http://cdn.example.test/file" } }, true, 0],
    ["paid HTTPS", { payment: { status: "paid" }, urls: { digital_content: "https://cdn.example.test/file" } }, true, 1]
  ])("evaluates digital delivery guard: %s", (_name, payload, paid, linkCount) => {
    const result = paidDigitalDelivery(payload);
    expect(result.paid).toBe(paid);
    expect(result.links).toHaveLength(linkCount);
  });

  it("normalizes digital credentials without exposing insecure links", () => {
    const result = paidDigitalDelivery({
      payment: { status: "paid" },
      urls: { digital_content: [
        { url: "https://cdn.example.test/license", name: "ترخيص", code: "CODE-1" },
        { url: "https://cdn.example.test/account", email: "buyer@example.test", password: "secret", duration_seconds: 3600 }
      ] }
    });
    expect(result.assets).toEqual([
      expect.objectContaining({ name: "ترخيص", code: "CODE-1", email: "" }),
      expect.objectContaining({ email: "buyer@example.test", password: "secret", durationSeconds: 3600 })
    ]);
    expect(result.links).toHaveLength(2);
  });

  it("persists CTA controls and requires an explicit opt-in for the digital link", () => {
    expect(appSource).toContain('name="buttonEnabled"');
    expect(appSource).toContain('name="buttonLabel"');
    expect(appSource).toContain('type="checkbox" name="secureLinkEnabled"');
    expect(appSource).toContain("secureLinkOptIn");
    expect(appSource).toContain('linkPreview.toggleAttribute("hidden", !secureLinkEnabled)');
    expect(serverSource).toContain("secureLinkEnabled: false");
    expect(serverSource).toContain("template.settings?.secureLinkOptIn === true");
    expect(digitalLinkDefaultOffMigration).toContain("template_key = 'digital_product_delivery'");
    expect(digitalLinkDefaultOffMigration).toContain("'{secureLinkEnabled}', 'false'::jsonb");
    expect(digitalLinkDefaultOffMigration).toContain("'{secureLinkOptIn}'");
    expect(digitalLinkDefaultOffMigration).toContain("'false'::jsonb");
    expect(appSource).toContain("عرض مدة المنتج");
    expect(serverSource).toContain("delivery_channel=COALESCE(delivery_channel,'whatsapp')");
    expect(serverSource).toContain('? "digital"');
    expect(styles).toContain(".salla-template-form-card>.section-head>svg");
  });

  it("keeps one save action and presents compact, readable editor controls", () => {
    expect(appSource).toContain("تفعيل زر الإجراء");
    expect(appSource).toContain("نص زر الإجراء");
    expect(appSource).not.toContain('form="salla-template-editor-form"');
    expect(appSource).toContain('<div class="salla-editor-actions"><button class="btn btn-primary" type="submit">');
    expect(styles).toContain(".salla-channel-panel>.variables-row{margin-top:18px");
    expect(styles).toContain(".salla-special-settings>.section-head>svg{width:24px!important;height:24px!important");
    expect(styles).toContain(".salla-action-settings .setting-line>span{min-width:0;display:grid;gap:5px}");
  });

  it("keeps the opposite channel content when the selected channel changes", () => {
    const switchedToEmail = resolveSallaChannelContent({
      channel: "email",
      input: { messageBody: "new email" },
      previous: {
        whatsappContent: "saved whatsapp",
        emailTextContent: "old email",
        emailHtmlContent: "saved html"
      },
      definition: { body: "default" }
    });
    expect(switchedToEmail).toEqual({
      whatsappContent: "saved whatsapp",
      emailTextContent: "new email",
      emailHtmlContent: "saved html"
    });
  });

  it("cancels delayed review requests when an order is cancelled or returned", () => {
    expect(serverSource).toContain("review_request_no_longer_valid");
    expect(serverSource).toContain("review_request_cancelled");
  });

  it("uses the saved store logo in every Salla email, including test deliveries", () => {
    expect(appSource).toContain('data-action="salla-email-logo-file"');
    expect(appSource).toContain('fetchJson("/api/order-link/profile/logo"');
    expect(serverSource).toContain('logo_url AS "logoUrl"');
    expect(serverSource).toContain("branding: {");
    expect(testRouteSource).toContain("payload.storeProfile?.logoUrl");
    expect(resendSource).toContain("branding.logoUrl || brandImageUrl");
    expect(styles).toContain(".salla-email-logo-editor");
  });

  describe.each(
    SALLA_TEMPLATE_DEFINITIONS.flatMap((definition) => ["whatsapp", "email"].map((channel) => ({
      definition,
      channel
    })))
  )("$definition.key through $channel", ({ definition, channel }) => {
    it("builds the correct independent channel preview", () => {
      const preview = previewSallaAutomationTemplate({
        channel,
        emailSubject: channel === "email" ? "طلبك {{order_number}}" : null,
        messageBody: definition.body
      });

      expect(preview.channel).toBe(channel);
      expect(preview.body.length).toBeGreaterThan(0);
      if (channel === "email") expect(preview.subject).toContain("#10025");
      else expect(preview.subject).toBeNull();
    });
  });
});
