import { query } from "../../../../../src/server/db.js";
import { queueOrderInformationLink } from "../../../../../src/server/message-queue.js";
import { requireSession } from "../../../../../src/server/session.js";
import { PLAN_MESSAGE_LIMIT_REACHED } from "../../../../../src/lib/billing/message-quota.js";

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const method = ["copy", "whatsapp", "email"].includes(body.method) ? body.method : "copy";
  const result = await query(
    `SELECT l.id, l.public_url AS "publicUrl", l.order_number AS "orderNumber", l.status,
            l.customer_id AS "customerId", l.subscription_id AS "subscriptionId",
            c.name AS "customerName", c.email,
            COALESCE(c.whatsapp_number, c.phone) AS "phoneNumber",
            p.store_name AS "storeName"
       FROM order_info_links l
       JOIN order_link_profiles p ON p.tenant_id = l.tenant_id
       LEFT JOIN customers c ON c.id = l.customer_id AND c.tenant_id = l.tenant_id
      WHERE l.id = $1 AND l.tenant_id = $2
      LIMIT 1`,
    [id, auth.session.tenantId]
  );
  const link = result.rows[0];
  if (!link) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (link.status !== "active") {
    return Response.json({ ok: false, reason: "link_not_active" }, { status: 409 });
  }

  if (method === "copy") {
    await query(
      "INSERT INTO order_link_events (tenant_id, order_info_link_id, event_type) VALUES ($1, $2, 'copied')",
      [auth.session.tenantId, id]
    );
    return Response.json({ ok: true, method, publicUrl: link.publicUrl });
  }

  let whatsappChannelId = null;
  if (method === "whatsapp") {
    const channel = await query(
      `SELECT id FROM whatsapp_channels
        WHERE tenant_id = $1 AND status = 'connected'
        ORDER BY connected_at DESC NULLS LAST, created_at DESC LIMIT 1`,
      [auth.session.tenantId]
    );
    whatsappChannelId = channel.rows[0]?.id || null;
  }

  const queued = await queueOrderInformationLink({
    tenantId: auth.session.tenantId,
    userId: auth.session.userId,
    link,
    method,
    whatsappChannelId
  });
  if (!queued.ok) {
    const messages = {
      [PLAN_MESSAGE_LIMIT_REACHED]: "وصلت إلى الحد الشهري لرسائل باقتك. قم بترقية الباقة أو انتظر بداية الدورة القادمة.",
      customer_email_missing: "لا يوجد بريد إلكتروني لهذا العميل. أضف بريدًا أو اختر الإرسال عبر واتساب/نسخ الرابط.",
      customer_phone_missing: "لا يوجد رقم جوال صالح لهذا العميل.",
      whatsapp_not_connected: "اربط جهاز واتساب أولًا حتى تتمكن من إرسال الرابط.",
      automatic_sending_paused: "الإرسال التلقائي متوقف مؤقتًا لحماية رقم واتساب.",
      sending_temporarily_paused: "الإرسال متوقف مؤقتًا بسبب فحص الحماية.",
      critical_risk: "تم إيقاف الإرسال لأن مستوى المخاطر مرتفع جدًا.",
      duplicate_message: "تم منع إرسال رسالة مكررة خلال فترة الحماية."
    };
    return Response.json(
      { ok: false, reason: queued.reason, message: messages[queued.reason] || "تعذر جدولة الرسالة." },
      { status: queued.reason === "critical_risk" ? 423 : 409 }
    );
  }

  await query(
    `UPDATE order_info_links SET send_method = $3, updated_at = now()
      WHERE id = $1 AND tenant_id = $2`,
    [id, auth.session.tenantId, method]
  );
  return Response.json({ ok: true, method, queued: true, ...queued }, { status: 202 });
}
