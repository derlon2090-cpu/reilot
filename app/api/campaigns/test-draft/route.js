import { z } from "zod";
import { sendEmail } from "../../../../src/lib/email/send-email.js";
import { sameOriginRequest } from "../../../../src/server/campaign-contacts.js";
import { query } from "../../../../src/server/db.js";
import { sendMetaTextMessage } from "../../../../src/server/meta-interactive-service.js";
import { requireSession } from "../../../../src/server/session.js";

const schema = z.object({
  channel: z.enum(["email", "whatsapp"]),
  channelId: z.string().uuid().nullable().optional(),
  destination: z.string().trim().min(3).max(320),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(12000)
});

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (String(auth.session.role || "").toLowerCase() === "viewer") return Response.json({ ok: false, message: "لا تملك صلاحية الإرسال." }, { status: 403 });
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid_input", message: parsed.error.issues[0]?.message || "بيانات الاختبار غير صالحة." }, { status: 400 });
  const input = parsed.data;
  try {
    let providerMessageId = null;
    if (input.channel === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.destination)) return Response.json({ ok: false, reason: "invalid_email", message: "أدخل بريدًا إلكترونيًا صالحًا." }, { status: 400 });
      const sent = await sendEmail({
        to: input.destination,
        subject: `[اختبار] ${input.subject}`,
        text: input.body,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;white-space:pre-wrap">${escapeHtml(input.body)}</div>`,
        tags: [{ name: "category", value: "campaign_draft_test" }],
        idempotencyKey: `campaign-draft-test-${auth.session.userId}-${Date.now()}`
      });
      providerMessageId = sent?.id || null;
    } else {
      if (!input.channelId) return Response.json({ ok: false, reason: "channel_required", message: "اختر قناة واتساب متصلة." }, { status: 400 });
      const owned = await query(`SELECT id,status FROM whatsapp_channels WHERE tenant_id=$1 AND id=$2`, [auth.session.tenantId, input.channelId]);
      if (!owned.rows[0] || owned.rows[0].status !== "connected") return Response.json({ ok: false, reason: "channel_unavailable", message: "قناة واتساب المحددة غير متصلة." }, { status: 409 });
      const destination = input.destination.replace(/[\s()+-]/g, "");
      if (!/^\d{8,15}$/.test(destination)) return Response.json({ ok: false, reason: "invalid_phone", message: "أدخل رقم واتساب بصيغة دولية صحيحة." }, { status: 400 });
      const sent = await sendMetaTextMessage({ channelId: input.channelId, to: destination, text: input.body });
      providerMessageId = sent?.messages?.[0]?.id || null;
    }
    await query(
      `INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata)
       VALUES($1,$2,'campaign.draft_test_sent','Campaign draft test sent',$3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ channel: input.channel, providerMessageId })]
    );
    return Response.json({ ok: true, providerMessageId });
  } catch (error) {
    return Response.json({ ok: false, reason: error.code || "test_failed", message: error.message || "تعذر إرسال الاختبار." }, { status: Number(error.status) || 502 });
  }
}
