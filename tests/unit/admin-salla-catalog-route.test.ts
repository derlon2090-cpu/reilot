import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminPermission: vi.fn(),
  auditAdmin: vi.fn(),
  listCatalog: vi.fn(),
  saveTemplate: vi.fn()
}));

vi.mock("../../src/server/admin-auth.js", () => ({
  requireAdminPermission: mocks.requireAdminPermission,
  auditAdmin: mocks.auditAdmin
}));

vi.mock("../../src/server/salla-admin-catalog.js", () => ({
  listSallaAdminCatalog: mocks.listCatalog,
  saveSallaAdminTemplate: mocks.saveTemplate
}));

import { GET, PUT } from "../../app/api/admin/integrations/salla/templates/route.js";

const catalog = Array.from({ length: 12 }, (_, index) => ({
  templateKey: `template_${index + 1}`,
  name: `قالب ${index + 1}`,
  whatsappContent: "محتوى واتساب",
  emailTextContent: "محتوى بريد",
  emailSubject: "عنوان البريد"
}));

describe("admin Salla catalog route", () => {
  beforeEach(() => {
    mocks.requireAdminPermission.mockReset().mockResolvedValue({
      ok: true,
      admin: { adminId: "admin-1", userId: "user-1", email: "admin@renvix.app" }
    });
    mocks.auditAdmin.mockReset();
    mocks.listCatalog.mockReset().mockResolvedValue(catalog);
    mocks.saveTemplate.mockReset().mockResolvedValue({ templateKey: "stored" });
  });

  it("lists all templates without requiring a tenant or Salla connection", async () => {
    const response = await GET(new Request("http://localhost/api/admin/integrations/salla/templates"));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.items).toHaveLength(12);
    expect(mocks.requireAdminPermission).toHaveBeenCalledWith(expect.any(Request), "integrations", "read");
  });

  it("saves only the selected channel default and never sends a message", async () => {
    const response = await PUT(new Request("http://localhost/api/admin/integrations/salla/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateKey: "processing", channel: "email", subject: "طلبك قيد التنفيذ", body: "مرحبًا {{customer_name}}" })
    }));
    expect(response.status).toBe(200);
    expect(mocks.saveTemplate).toHaveBeenCalledWith({
      adminId: "admin-1",
      templateKey: "processing",
      channel: "email",
      subject: "طلبك قيد التنفيذ",
      body: "مرحبًا {{customer_name}}"
    });
    expect(mocks.auditAdmin).toHaveBeenCalledWith(expect.any(Request), expect.objectContaining({
      action: "admin.salla.default_template.updated",
      resource: "processing",
      metadata: { channel: "email" }
    }));
  });

  it("rejects an email default without a subject", async () => {
    const response = await PUT(new Request("http://localhost/api/admin/integrations/salla/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateKey: "processing", channel: "email", body: "رسالة" })
    }));
    expect(response.status).toBe(400);
    expect(mocks.saveTemplate).not.toHaveBeenCalled();
  });

  it("sanitizes and stores the same optional HTML email source exposed to users", async () => {
    const response = await PUT(new Request("http://localhost/api/admin/integrations/salla/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey: "processing",
        channel: "email",
        subject: "طلبك قيد التنفيذ",
        body: "نسخة نصية",
        settings: {
          emailDesign: "editorial",
          emailContentMode: "html",
          emailThemeColor: "#0B3F3B",
          emailHtmlContent: '<section dir="rtl"><h2>تحديث الطلب</h2><p>مرحبًا {{customer_name}}</p></section>'
        }
      })
    }));
    expect(response.status).toBe(200);
    expect(mocks.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({ emailContentMode: "html", emailHtmlContent: expect.stringContaining("تحديث الطلب") })
    }));
  });

  it("rejects unsafe HTML before it becomes a platform default", async () => {
    const response = await PUT(new Request("http://localhost/api/admin/integrations/salla/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey: "processing",
        channel: "email",
        subject: "عنوان",
        body: "نسخة نصية",
        settings: { emailContentMode: "html", emailHtmlContent: "<script>alert(1)</script>" }
      })
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).reason).toBe("invalid_email_html");
    expect(mocks.saveTemplate).not.toHaveBeenCalled();
  });
});
