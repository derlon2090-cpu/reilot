import { query } from "../../../../../src/server/db.js";
import { enqueueMessage } from "../../../../../src/server/message-queue.js";
import { recordOperationalIssue } from "../../../../../src/server/operations.js";
import { requireSession } from "../../../../../src/server/session.js";
import { createInAppNotification } from "../../../../../src/server/in-app-notifications.js";
import { PLAN_MESSAGE_LIMIT_REACHED } from "../../../../../src/lib/billing/message-quota.js";

function reminderText(item) {
  return `مرحبًا ${item.customerName || "عميلنا"}،\nنذكّرك بأن اشتراكك في ${item.serviceName || "الخدمة"} سينتهي في ${String(item.endDate || "").slice(0, 10)}.\nيمكنك التجديد من خلال الرابط التالي:\n${item.renewalUrl || "تواصل معنا لإتمام التجديد."}`;
}

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const selected = await query(
    `SELECT s.id, s.customer_id AS "customerId", s.service_name AS "serviceName",
            s.end_date AS "endDate", s.renewal_url AS "renewalUrl",
            c.name AS "customerName", COALESCE(c.whatsapp_number, c.phone) AS phone,
            c.reminders_paused AS "remindersPaused",
            wc.id AS "channelId", wc.status AS "channelStatus",
            EXISTS(
              SELECT 1 FROM unsubscribe_list ul
               WHERE ul.tenant_id = s.tenant_id
                 AND ul.phone_number IN (c.phone, c.whatsapp_number)
            ) AS unsubscribed,
            (SELECT id FROM notification_templates nt
              WHERE nt.tenant_id = s.tenant_id AND nt.channel = 'whatsapp' AND nt.is_active = true
              ORDER BY created_at LIMIT 1) AS "templateId"
       FROM subscriptions s
       JOIN customers c ON c.id = s.customer_id AND c.tenant_id = s.tenant_id
       LEFT JOIN LATERAL (
         SELECT id, status FROM whatsapp_channels
          WHERE tenant_id = s.tenant_id
          ORDER BY connected_at DESC NULLS LAST, created_at DESC LIMIT 1
       ) wc ON true
      WHERE s.id = $1 AND s.tenant_id = $2 LIMIT 1`,
    [id, auth.session.tenantId]
  );
  const item = selected.rows[0];
  let reason = null;
  if (!item) reason = "subscription_not_found";
  else if (item.remindersPaused) reason = "reminders_paused";
  else if (item.unsubscribed) reason = "unsubscribed";
  else if (item.channelStatus !== "connected") reason = "whatsapp_not_connected";
  if (reason) {
    if (reason !== "subscription_not_found") {
      await recordOperationalIssue({
        tenantId: auth.session.tenantId,
        category: "safe_mode",
        source: "manual_reminder",
        sourceId: id,
        severity: "warning",
        message: reason,
        suggestedSolution: reason === "whatsapp_not_connected"
          ? "Connect WhatsApp before sending reminders."
          : "Review customer messaging permissions."
      }).catch(() => null);
    }
    return Response.json({ ok: false, reason }, { status: reason === "subscription_not_found" ? 404 : 409 });
  }
  const queued = await enqueueMessage({
    tenantId: auth.session.tenantId,
    customerId: item.customerId,
    subscriptionId: id,
    whatsappChannelId: item.channelId,
    templateId: item.templateId,
    channelType: "whatsapp",
    messageType: "renewal_reminder",
    destination: item.phone,
    messageBody: reminderText(item),
    referenceType: "subscription",
    referenceId: id,
    triggerKey: `manual:${id}:${new Date().toISOString().slice(0, 10)}`,
    sourceMode: "manual",
    enforceConnected: true
  });
  if (!queued.ok) {
    await recordOperationalIssue({
      tenantId: auth.session.tenantId,
      category: queued.reason === PLAN_MESSAGE_LIMIT_REACHED ? "message_quota" : "safe_mode",
      source: "manual_reminder",
      sourceId: id,
      severity: queued.reason === "critical_risk" ? "critical" : "warning",
      message: queued.reason,
      suggestedSolution: queued.reason === PLAN_MESSAGE_LIMIT_REACHED
        ? "قم بترقية الباقة أو انتظر بداية دورة الرسائل القادمة."
        : "Review WhatsApp connection, safety score, and sending schedule."
    }).catch(() => null);
    return Response.json({
      ok: false,
      code: queued.code || queued.reason,
      reason: queued.reason,
      usage: queued.usage,
      message: queued.reason === PLAN_MESSAGE_LIMIT_REACHED ? "وصلت إلى الحد الشهري لرسائل باقتك." : undefined
    }, { status: queued.reason === "critical_risk" ? 423 : 409 });
  }
  await query(
    `INSERT INTO activity_logs (tenant_id, user_id, customer_id, type, title, metadata)
     VALUES ($1, $2, $3, 'subscription.reminder_queued', 'Renewal reminder queued', $4::jsonb)`,
    [auth.session.tenantId, auth.session.userId, item.customerId,
      JSON.stringify({ subscriptionId: id, queueId: queued.queueId, scheduledFor: queued.scheduledFor })]
  );
  await createInAppNotification({
    tenantId: auth.session.tenantId,
    userId: auth.session.userId,
    type: "message_scheduled",
    title: "تمت جدولة تذكير التجديد",
    message: `تمت إضافة تذكير ${item.customerName || "العميل"} إلى قائمة الإرسال الآمن.`,
    entityType: "subscription",
    entityId: id,
    actionUrl: `/dashboard/subscriptions?subscriptionId=${id}`,
    metadata: { queueId: queued.queueId, scheduledFor: queued.scheduledFor },
    dedupeKey: `manual-reminder:${id}:${new Date().toISOString().slice(0, 10)}`
  }).catch(() => null);
  return Response.json({ ok: true, queueId: queued.queueId, scheduledFor: queued.scheduledFor }, { status: 202 });
}
