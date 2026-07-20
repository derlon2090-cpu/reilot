import { query } from "../../../../../src/server/db.js";
import { enqueueMessage } from "../../../../../src/server/message-queue.js";
import { recordOperationalIssue } from "../../../../../src/server/operations.js";
import { requireSession } from "../../../../../src/server/session.js";
import { createInAppNotification } from "../../../../../src/server/in-app-notifications.js";
import { PLAN_MESSAGE_LIMIT_REACHED } from "../../../../../src/lib/billing/message-quota.js";

function reminderText(item) {
  return `مرحبًا ${item.customerName || "عميلنا"}،\nنذكّرك بأن اشتراكك في ${item.serviceName || "الخدمة"} سينتهي في ${String(item.endDate || "").slice(0, 10)}.\nيمكنك التجديد من خلال الرابط التالي:\n${item.renewalUrl || "تواصل معنا لإتمام التجديد."}`;
}

function renderTemplate(value, item, fallback = "") {
  return String(value || fallback)
    .replace(/{{customer_name}}|{{name}}|{{اسم_العميل}}/g, item.customerName || "عميلنا")
    .replace(/{{service_name}}|{{اسم_الخدمة}}/g, item.serviceName || "الاشتراك")
    .replace(/{{plan_name}}|{{اسم_الباقة}}/g, item.planName || "")
    .replace(/{{end_date}}|{{تاريخ_الانتهاء}}/g, String(item.endDate || "").slice(0, 10))
    .replace(/{{الأيام_المتبقية}}/g, String(item.reminderDaysBefore ?? ""))
    .replace(/{{renewal_link}}|{{رابط_التجديد}}/g, item.renewalUrl || "")
    .replace(/{{رقم_الطلب}}/g, item.orderNumber || "")
    .replace(/{{اسم_المتجر}}/g, item.storeName || "Renvix");
}

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const selected = await query(
    `SELECT s.id, s.customer_id AS "customerId", s.order_number AS "orderNumber",
            s.service_name AS "serviceName", s.plan_name AS "planName",
            s.end_date AS "endDate", s.renewal_url AS "renewalUrl",
            s.reminder_channel AS "channelType", s.reminder_days_before AS "reminderDaysBefore",
            c.name AS "customerName", c.email, COALESCE(c.whatsapp_number, c.phone) AS phone,
            c.reminders_paused AS "remindersPaused",
            wc.id AS "channelId", wc.status AS "channelStatus",
            EXISTS(
              SELECT 1 FROM unsubscribe_list ul
               WHERE ul.tenant_id = s.tenant_id
                 AND ul.phone_number IN (c.phone, c.whatsapp_number)
            ) AS unsubscribed,
            nt.id AS "templateId", nt.title, nt.body, nt.store_name AS "storeName",
            nt.theme_color AS "themeColor", nt.button_label AS "buttonLabel",
            nt.footer_text AS "footerText", nt.template_version AS "templateVersion"
       FROM subscriptions s
       JOIN customers c ON c.id = s.customer_id AND c.tenant_id = s.tenant_id
       LEFT JOIN LATERAL (
         SELECT id, title, body, store_name, theme_color, button_label, footer_text, template_version
           FROM notification_templates
          WHERE tenant_id = s.tenant_id AND channel = s.reminder_channel AND is_active = true
          ORDER BY updated_at DESC, created_at DESC LIMIT 1
       ) nt ON true
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
  else if (item.channelType === "email" && !item.email) reason = "customer_email_missing";
  else if (item.channelType === "whatsapp" && item.unsubscribed) reason = "unsubscribed";
  else if (item.channelType === "whatsapp" && item.channelStatus !== "connected") reason = "whatsapp_not_connected";
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
          : reason === "customer_email_missing"
            ? "Add a valid customer email before sending an email reminder."
          : "Review customer messaging permissions."
      }).catch(() => null);
    }
    return Response.json({ ok: false, reason }, { status: reason === "subscription_not_found" ? 404 : 409 });
  }
  const channelType = item.channelType === "email" ? "email" : "whatsapp";
  const messageBody = item.body ? renderTemplate(item.body, item) : reminderText(item);
  const subject = channelType === "email"
    ? renderTemplate(item.title, item, "تذكير بتجديد اشتراكك في {{اسم_الخدمة}}")
    : null;
  const templateSnapshot = channelType === "email" ? {
    type: "renewal_email_v1",
    version: Number(item.templateVersion || 1),
    template: {
      storeName: item.storeName || "Renvix",
      title: item.title || "تذكير بتجديد اشتراكك في {{اسم_الخدمة}}",
      themeColor: item.themeColor || "#0EA5A8",
      body: item.body || messageBody,
      buttonLabel: item.buttonLabel || "جدد اشتراكك الآن",
      footerText: item.footerText || "شكرًا لثقتك بنا"
    },
    data: {
      customerName: item.customerName,
      serviceName: item.serviceName,
      endDate: String(item.endDate || "").slice(0, 10),
      remainingDays: item.reminderDaysBefore,
      renewalLink: item.renewalUrl,
      orderNumber: item.orderNumber
    }
  } : null;
  const queued = await enqueueMessage({
    tenantId: auth.session.tenantId,
    customerId: item.customerId,
    subscriptionId: id,
    whatsappChannelId: channelType === "whatsapp" ? item.channelId : null,
    templateId: item.templateId,
    channelType,
    messageType: "renewal_reminder",
    destination: channelType === "email" ? item.email : item.phone,
    emailTo: channelType === "email" ? item.email : null,
    subject,
    messageBody,
    templateSnapshot,
    referenceType: "subscription",
    referenceId: id,
    triggerKey: `manual:${id}:${channelType}:${new Date().toISOString().slice(0, 10)}`,
    sourceMode: "manual",
    enforceConnected: channelType === "whatsapp"
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
      JSON.stringify({ subscriptionId: id, channel: channelType, queueId: queued.queueId, scheduledFor: queued.scheduledFor })]
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
    metadata: { channel: channelType, queueId: queued.queueId, scheduledFor: queued.scheduledFor },
    dedupeKey: `manual-reminder:${id}:${channelType}:${new Date().toISOString().slice(0, 10)}`
  }).catch(() => null);
  return Response.json({ ok: true, queueId: queued.queueId, scheduledFor: queued.scheduledFor }, { status: 202 });
}
