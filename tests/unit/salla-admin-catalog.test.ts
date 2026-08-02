import { describe, expect, it } from "vitest";
import { mergeSallaAdminCatalog, platformSallaTemplateKey } from "../../src/server/salla-admin-catalog.js";

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
});
