import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeSallaAdminCatalog, platformSallaTemplateKey } from "../../src/server/salla-admin-catalog.js";

const adminCatalogSource = fs.readFileSync("src/components/admin/AdminSallaCatalog.jsx", "utf8");
const adminPortalStyles = fs.readFileSync("src/components/admin/AdminPortal.module.css", "utf8");

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
      { templateKey: platformSallaTemplateKey("digital_product_delivery", "whatsapp"), body: "رسالة", settings: { buttonEnabled: false, buttonLabel: "فتح الترخيص", secureLinkEnabled: true } }
    ]);
    expect(item.settings).toMatchObject({ buttonEnabled: false, buttonLabel: "فتح الترخيص", secureLinkEnabled: true });
  });

  it("reveals a real WhatsApp image uploader and binds the uploaded image to the preview", () => {
    expect(adminCatalogSource).toContain('draft.whatsappImageEnabled ? <div className="salla-whatsapp-image-editor is-open"');
    expect(adminCatalogSource).toContain("uploadWhatsAppImage");
    expect(adminCatalogSource).toContain("draft.whatsappImageUrl ? <img");
    expect(adminCatalogSource).toContain("/api/admin/integrations/salla/templates/${encodeURIComponent(selected.templateKey)}/image");
    expect(adminCatalogSource).toContain("whatsappImageUrl: draft.whatsappImageEnabled");
  });

  it("shows digital delivery design controls only while the secure link is enabled", () => {
    expect(adminCatalogSource).toContain("draft.secureLinkEnabled ? <div className=\"salla-link-options\"");
    expect(adminCatalogSource).toContain("عند إيقافه تظهر معاينة القناة فقط");
    expect(adminCatalogSource).toContain("deliveryPageCustomCss");
    expect(adminCatalogSource).toContain("sallaPageCssVariables(draft.deliveryPageCustomCss)");
    expect(adminCatalogSource).toContain("للمعاينة الإدارية فقط");
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

  it("bounds every admin preview to the fields row instead of the action buttons", () => {
    expect(adminCatalogSource).toContain("data-admin-salla-editor-layout");
    expect(adminCatalogSource).toContain("data-admin-salla-preview-slot");
    expect(adminCatalogSource).toContain('form="admin-salla-template-form"');
    expect(adminPortalStyles).toContain(".adminSallaPreviewSlot { position: relative; grid-column: 2; grid-row: 1;");
    expect(adminPortalStyles).toContain(".adminSallaBoundedActions { grid-column: 1; grid-row: 2;");
    expect(adminPortalStyles).toContain(".adminSallaPreviewSlot > .adminSallaBoundedPreview { position: absolute; inset: 0;");
  });

  it("separates and animates the digital delivery link preview inside its own scroll area", () => {
    expect(adminCatalogSource).toContain("data-admin-salla-channel-preview");
    expect(adminCatalogSource).toContain("data-admin-salla-link-preview");
    expect(adminPortalStyles).toContain(".adminSallaPreviewScrollerDigital { gap: 32px; }");
    expect(adminPortalStyles).toContain("animation: adminSallaLinkPreviewReveal .52s");
    expect(adminPortalStyles).toContain("overflow-y: auto;");
    expect(adminPortalStyles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
