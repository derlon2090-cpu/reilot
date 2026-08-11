import { z } from "zod";
import { auditAdmin, requireAdminPermission } from "../../../../../../src/server/admin-auth.js";
import { listSallaAdminCatalog, saveSallaAdminTemplate } from "../../../../../../src/server/salla-admin-catalog.js";
import { inspectCustomEmailHtml } from "../../../../../../src/lib/email/custom-email-html.js";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  templateKey: z.string().trim().min(1).max(100),
  channel: z.enum(["whatsapp", "email"]),
  subject: z.string().trim().max(300).optional().nullable(),
  body: z.string().trim().min(1).max(10000),
  settings: z.object({
    buttonEnabled: z.boolean().optional(),
    buttonLabel: z.string().trim().max(80).optional(),
    secureLinkEnabled: z.boolean().optional(),
    secureLinkOptIn: z.boolean().optional(),
    linkPageTitle: z.string().trim().max(160).optional(),
    linkPageContent: z.string().trim().max(5000).optional(),
    showCountdown: z.boolean().optional(),
    showDuration: z.boolean().optional(),
    whatsappImageEnabled: z.boolean().optional(),
    whatsappImageUrl: z.union([z.string().url().max(2000), z.literal("")]).optional(),
    emailDesign: z.enum(["classic", "modern", "minimal", "premium", "editorial", "commerce", "aurora", "executive"]).optional(),
    emailContentMode: z.enum(["preset", "html"]).optional(),
    emailThemeColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    emailHtmlContent: z.string().max(30000).optional(),
    deliveryPageDesign: z.enum(["classic", "cards", "compact"]).optional(),
    deliveryPageCustomCss: z.string().max(4000).optional(),
    reviewTriggerStatus: z.enum(["shipped", "delivered", "completed"]).optional(),
    reviewDelayMinutes: z.number().int().min(5).max(2880).optional(),
    delaysMinutes: z.array(z.number().int().min(5).max(2880)).max(3).optional(),
    stopOnConversion: z.boolean().optional(),
    completedDeliveryMode: z.literal("secure_order_page").optional(),
    showSubscriptionDuration: z.boolean().optional(),
    themeColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional()
  }).optional()
});

export async function GET(request) {
  const auth = await requireAdminPermission(request, "integrations", "read");
  if (!auth.ok) return auth.response;
  const items = await listSallaAdminCatalog();
  return Response.json({ ok: true, items, previewOnly: false }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" }
  });
}

export async function PUT(request) {
  const auth = await requireAdminPermission(request, "integrations", "update");
  if (!auth.ok) return auth.response;
  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "validation_error", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  if (parsed.data.channel === "email" && !parsed.data.subject) {
    return Response.json({ ok: false, reason: "email_subject_required" }, { status: 400 });
  }
  let data = parsed.data;
  if (parsed.data.channel === "email" && parsed.data.settings?.emailContentMode === "html") {
    const inspection = inspectCustomEmailHtml(parsed.data.settings.emailHtmlContent || "");
    if (!inspection.ok) return Response.json({ ok: false, reason: "invalid_email_html", errors: inspection.errors }, { status: 400 });
    data = { ...parsed.data, settings: { ...parsed.data.settings, emailHtmlContent: inspection.html } };
  }
  const saved = await saveSallaAdminTemplate({ adminId: auth.admin.adminId, ...data });
  if (!saved) return Response.json({ ok: false, reason: "template_not_found" }, { status: 404 });
  await auditAdmin(request, {
    admin: auth.admin,
    action: "admin.salla.default_template.updated",
    resource: parsed.data.templateKey,
    metadata: { channel: parsed.data.channel }
  });
  const items = await listSallaAdminCatalog();
  return Response.json({ ok: true, items, message: "تم حفظ الإعداد الافتراضي للقناة المحددة." }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" }
  });
}
