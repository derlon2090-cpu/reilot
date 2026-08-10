import { z } from "zod";
import { sendEmail } from "../../../../../src/lib/email/send-email.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { query } from "../../../../../src/server/db.js";
import { sendMetaTextMessage } from "../../../../../src/server/meta-interactive-service.js";
import { requireSession } from "../../../../../src/server/session.js";

const schema = z.object({ destination: z.string().trim().min(3).max(320) });

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (String(auth.session.role || "").toLowerCase() === "viewer") return Response.json({ ok: false, message: "لا تملك صلاحية الإرسال." }, { status: 403 });
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid_destination", message: "أدخل مستلمًا صالحًا للاختبار." }, { status: 400 });
  const { campaignId } = await params;
  const result = await query(`SELECT id,name,channel,subject,body,whatsapp_channel_id AS "whatsappChannelId" FROM campaigns WHERE tenant_id=$1 AND id=$2`, [auth.session.tenantId, campaignId]);
  const campaign = result.rows[0];
  if (!campaign) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  try {
    let providerMessageId = null;
    if (campaign.channel === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.data.destination)) return Response.json({ ok: false, reason: "invalid_email", message: "أدخل بريدًا إلكترونيًا صالحًا." }, { status: 400 });
      const body = String(campaign.body || "").trim();
      const sent = await sendEmail({ to: parsed.data.destination, subject: `[اختبار] ${campaign.subject || campaign.name}`, text: body, html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;white-space:pre-wrap">${escapeHtml(body)}</div>`, tags: [{ name: "category", value: "campaign_test" }], idempotencyKey: `campaign-test-${campaign.id}-${Date.now()}` });
      providerMessageId = sent?.id || null;
    } else {
      const destination = parsed.data.destination.replace(/[\s()+-]/g, "");
      if (!/^\d{8,15}$/.test(destination)) return Response.json({ ok: false, reason: "invalid_phone", message: "أدخل رقم واتساب بصيغة دولية صحيحة." }, { status: 400 });
      if (!campaign.whatsappChannelId) return Response.json({ ok: false, reason: "channel_not_configured", message: "لا ترتبط الحملة بقناة واتساب رسمية." }, { status: 409 });
      const sent = await sendMetaTextMessage({ channelId: campaign.whatsappChannelId, to: destination, text: campaign.body });
      providerMessageId = sent?.messages?.[0]?.id || null;
    }
    await query(`INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata) VALUES($1,$2,'campaign.test_sent','Campaign test sent',$3::jsonb)`, [auth.session.tenantId, auth.session.userId, JSON.stringify({ campaignId, channel: campaign.channel, providerMessageId })]);
    return Response.json({ ok: true, providerMessageId });
  } catch (error) {
    return Response.json({ ok: false, reason: error.code || "test_failed", message: error.message || "تعذر إرسال الاختبار." }, { status: Number(error.status) || 502 });
  }
}
