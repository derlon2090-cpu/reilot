import { requireSession } from "../../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../../src/server/campaign-contacts.js";
import {
  getSallaAutomationTemplate,
  previewSallaAutomationTemplate
} from "../../../../../../../src/server/salla-templates.js";
import { enqueueMessage } from "../../../../../../../src/server/message-queue.js";
import { query } from "../../../../../../../src/server/db.js";

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  try {
    const { templateKey } = await params;
    const input = await request.json().catch(() => ({}));
    const payload = await getSallaAutomationTemplate({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      templateKey
    });
    const item = payload.item;
    if (!item?.channel) return Response.json({ ok: false, message: "حدد قناة الإرسال أولًا." }, { status: 409 });
    const preview = previewSallaAutomationTemplate(item, input.variables);
    const destination = String(input.destination || "").trim();
    if (!destination) return Response.json({ ok: false, message: "أدخل مستلم الاختبار." }, { status: 400 });
    const channel = item.channel === "whatsapp" ? await query(
      `SELECT id FROM whatsapp_channels WHERE tenant_id=$1 AND provider IN ('meta','meta_cloud_api')
        AND status='connected' ORDER BY updated_at DESC LIMIT 1`,
      [auth.session.tenantId]
    ) : { rows: [] };
    const queued = await enqueueMessage({
      tenantId: auth.session.tenantId,
      whatsappChannelId: channel.rows[0]?.id || null,
      templateId: null,
      templateSnapshot: item.channel === "whatsapp" ? {
        provider: "meta",
        metaTemplateId: item.whatsappTemplateId,
        sallaTemplateKey: item.templateKey,
        test: true
      } : {
        provider: "resend",
        sallaTemplateKey: item.templateKey,
        test: true,
        emailDesign: item.settings?.emailDesign || "classic",
        emailContentMode: item.settings?.emailContentMode || "preset",
        emailHtmlContent: item.settings?.emailContentMode === "html" ? item.emailHtmlContent || "" : "",
        branding: {
          brandName: payload.storeProfile?.storeName || payload.integration?.storeName || "Renvix",
          logoUrl: payload.storeProfile?.logoUrl || "",
          logoBorderRadius: Number(payload.storeProfile?.logoBorderRadius ?? 16)
        }
      },
      channelType: item.channel,
      messageType: "salla_template_test",
      destination,
      emailTo: item.channel === "email" ? destination : null,
      subject: preview.subject,
      messageBody: `هذه رسالة اختبار من Renvix ولا تخص طلبًا فعليًا.\n\n${preview.body}`,
      referenceType: "salla_template_test",
      referenceId: item.id,
      triggerKey: `salla-template-test:${auth.session.tenantId}:${item.id}:${Date.now()}`,
      sourceMode: "manual",
      isBillable: false,
      enforceConnected: item.channel === "whatsapp"
    });
    return Response.json(queued, { status: queued.ok ? 202 : 409 });
  } catch (error) {
    return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status || 500 });
  }
}
