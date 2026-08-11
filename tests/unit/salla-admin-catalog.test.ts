import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeSallaAdminCatalog, platformSallaTemplateKey } from "../../src/server/salla-admin-catalog.js";

const adminCatalogSource = fs.readFileSync("src/components/admin/AdminSallaCatalog.jsx", "utf8");
const userCatalogSource = fs.readFileSync("src/app/app.js", "utf8");
const sharedUiSource = fs.readFileSync("src/data/sallaTemplateUi.js", "utf8");
const globalStyles = fs.readFileSync("src/styles/globals.css", "utf8");

describe("Salla admin application catalog", () => {
  it("always exposes the 12 canonical Salla templates without a store connection", () => {
    const items = mergeSallaAdminCatalog([]);
    expect(items).toHaveLength(12);
    expect(new Set(items.map((item) => item.templateKey)).size).toBe(12);
    expect(items.every((item) => item.whatsappContent && item.emailTextContent && item.emailSubject)).toBe(true);
  });

  it("keeps WhatsApp and email defaults independent", () => {
    const key = "processing";
    const items = mergeSallaAdminCatalog([
      { templateKey: platformSallaTemplateKey(key, "whatsapp"), body: "محتوى واتساب مخصص", subject: null, updatedAt: "2026-08-02T10:00:00.000Z" },
      { templateKey: platformSallaTemplateKey(key, "email"), body: "محتوى بريد مخصص", subject: "عنوان بريد مخصص", updatedAt: "2026-08-02T11:00:00.000Z" }
    ]);
    const item = items.find((row) => row.templateKey === key);
    expect(item?.whatsappContent).toBe("محتوى واتساب مخصص");
    expect(item?.emailTextContent).toBe("محتوى بريد مخصص");
    expect(item?.emailSubject).toBe("عنوان بريد مخصص");
    expect(item?.updatedAt).toBe("2026-08-02T11:00:00.000Z");
  });

  it("uses isolated storage keys per template and channel", () => {
    expect(platformSallaTemplateKey("completed", "whatsapp")).toBe("platform_salla_default_completed_whatsapp");
    expect(platformSallaTemplateKey("completed", "email")).toBe("platform_salla_default_completed_email");
  });

  it("merges safe presentation settings for the admin and future tenant defaults", () => {
    const [item] = mergeSallaAdminCatalog([
      { templateKey: platformSallaTemplateKey("digital_product_delivery", "whatsapp"), body: "رسالة", settings: { buttonEnabled: false, buttonLabel: "فتح الترخيص", secureLinkEnabled: true } },
      { templateKey: platformSallaTemplateKey("digital_product_delivery", "email"), body: "بريد", settings: { emailContentMode: "html", emailHtmlContent: "<p>رسالة آمنة</p>" } }
    ]);
    expect(item.settings).toMatchObject({ buttonEnabled: false, buttonLabel: "فتح الترخيص", secureLinkEnabled: true });
    expect(item.emailHtmlContent).toBe("<p>رسالة آمنة</p>");
  });

  it("reveals a real WhatsApp image uploader and binds the uploaded image to the preview", () => {
    expect(adminCatalogSource).toContain('draft.whatsappImageEnabled ? <div className="salla-whatsapp-image-editor"');
    expect(adminCatalogSource).toContain("uploadWhatsAppImage");
    expect(adminCatalogSource).toContain("draft.whatsappImageEnabled && imageUrl ? <img");
    expect(adminCatalogSource).toContain("/api/admin/integrations/salla/templates/${encodeURIComponent(selected.templateKey)}/image");
    expect(adminCatalogSource).toContain("whatsappImageUrl: draft.whatsappImageEnabled");
  });

  it("shows digital delivery design controls only while the secure link is enabled", () => {
    expect(adminCatalogSource).toContain("draft.secureLinkEnabled ? <div className=\"salla-link-options\"");
    expect(adminCatalogSource).toContain("عند إيقافه تظهر معاينة القناة فقط");
    expect(adminCatalogSource).toContain("deliveryPageCustomCss");
    expect(adminCatalogSource).toContain("sallaPageCssVariables(draft.deliveryPageCustomCss)");
    expect(adminCatalogSource).toContain("يُستخدم شعار المتجر المحفوظ نفسه داخل البريد وصفحة التسليم الآمنة");
    expect(adminCatalogSource).toContain("كود تصميم صفحة الرابط (CSS آمن) — اختياري");
  });

  it("links review-request timing to one persisted Salla order state", () => {
    expect(adminCatalogSource).toContain('reviewTriggerStatus: "delivered"');
    expect(adminCatalogSource).toContain("يتم إرسال رسالة طلب التقييم عند الحالة");
    expect(adminCatalogSource).toContain('<option value="shipped">تم الشحن</option>');
    expect(adminCatalogSource).toContain('<option value="delivered">تم التوصيل</option>');
    expect(adminCatalogSource).toContain('<option value="completed">تم التنفيذ</option>');
    expect(adminCatalogSource).toContain("reviewTriggerStatus: draft.reviewTriggerStatus");
  });

  it("keeps the applications return action in a dedicated upper-left row", () => {
    expect(adminCatalogSource).toContain('className="salla-template-editor-top"');
    expect(adminCatalogSource).toContain('href="/admin/integrations"');
  });

  it("uses the exact user editor structure so actions never extend the preview row", () => {
    expect(adminCatalogSource).toContain('className="salla-template-editor-form"');
    expect(adminCatalogSource).toContain('className="salla-template-editor-layout"');
    expect(adminCatalogSource).toContain('className="card salla-template-form-card"');
    expect(adminCatalogSource.indexOf("<TemplatePreview")).toBeLessThan(adminCatalogSource.indexOf('<div className="salla-editor-actions">'));
    expect(globalStyles).toContain(".salla-template-editor-form{display:grid;gap:12px");
    expect(globalStyles).toContain(".salla-template-live-preview{grid-column:2;grid-row:1}");
  });

  it("separates and animates the digital delivery link preview for user and admin alike", () => {
    expect(adminCatalogSource).toContain("data-admin-salla-link-preview");
    expect(globalStyles).toContain(".salla-template-live-preview.is-digital-delivery .salla-template-preview-stack{gap:32px}");
    expect(globalStyles).toContain("animation:sallaDigitalLinkPreviewReveal .52s");
    expect(globalStyles).toContain("@media (prefers-reduced-motion:reduce)");
  });

  it("keeps the admin mirror on the same current controls and preview anatomy as the user", () => {
    expect(userCatalogSource).toContain('from "../data/sallaTemplateUi.js"');
    expect(adminCatalogSource).toContain('from "../../data/sallaTemplateUi.js"');
    for (const marker of [
      "salla-email-builder-panel",
      "salla-email-design-section",
      "email-design-builder is-salla-catalog has-theme-control",
      "تصميم الرسالة بكود HTML",
      "salla-whatsapp-phone-header",
      "salla-whatsapp-phone-day",
      "salla-whatsapp-phone-composer",
      "salla-preview-important-note",
      "قالب Meta المعتمد",
      "عرض مدة المنتج"
    ]) expect(adminCatalogSource).toContain(marker);
    for (const design of ["editorial", "commerce", "executive"]) expect(sharedUiSource).toContain(design);
  });
});
