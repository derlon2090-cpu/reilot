import { validateCronRequest } from "../../_lib/cron.js";
import { query } from "../../../../src/server/db.js";
import { createInAppNotification } from "../../../../src/server/in-app-notifications.js";
import { safeErrorMessage } from "../../../../src/server/security.js";

function notificationCopy(item) {
  const customer = item.customerName || "العميل";
  const service = item.serviceName || "الاشتراك";
  if (item.remainingDays === 0) {
    return {
      type: "subscription_expiring",
      title: `ينتهي اشتراك ${customer} اليوم`,
      message: `اشتراك ${service} ينتهي اليوم.`,
      priority: "high",
      dedupeKey: `subscription:${item.id}:remaining:0`
    };
  }
  if (item.remainingDays < 0) {
    return {
      type: "subscription_expired",
      title: `انتهى اشتراك ${customer}`,
      message: `انتهى اشتراك ${service}. راجع حالة التجديد.`,
      priority: "high",
      dedupeKey: `subscription:${item.id}:expired`
    };
  }
  return {
    type: "subscription_expiring",
    title: `اقترب انتهاء اشتراك ${customer}`,
    message: `متبقي ${item.remainingDays} ${item.remainingDays === 1 ? "يوم" : "أيام"} على اشتراك ${service}.`,
    priority: item.remainingDays <= 3 ? "high" : "normal",
    dedupeKey: `subscription:${item.id}:remaining:${item.remainingDays}`
  };
}

export async function GET(req) {
  const validation = validateCronRequest(req);
  if (!validation.ok) {
    return Response.json({ ok: false, error: validation.error }, { status: validation.status });
  }

  try {
    const subscriptions = await query(
      `SELECT s.id, s.tenant_id AS "tenantId", s.customer_id AS "customerId",
              s.service_name AS "serviceName", s.end_date AS "endDate",
              c.name AS "customerName",
              (s.end_date - (now() AT TIME ZONE 'Asia/Riyadh')::date)::int AS "remainingDays"
         FROM subscriptions s
         JOIN customers c ON c.id = s.customer_id AND c.tenant_id = s.tenant_id
        WHERE s.status NOT IN ('cancelled', 'renewed')
          AND (
            s.end_date - (now() AT TIME ZONE 'Asia/Riyadh')::date IN (7, 3, 0)
            OR s.end_date < (now() AT TIME ZONE 'Asia/Riyadh')::date
          )`
    );

    let created = 0;
    let skipped = 0;
    for (const item of subscriptions.rows) {
      const copy = notificationCopy(item);
      const notification = await createInAppNotification({
        tenantId: item.tenantId,
        type: copy.type,
        title: copy.title,
        message: copy.message,
        entityType: "subscription",
        entityId: item.id,
        priority: copy.priority,
        actionUrl: `/dashboard/subscriptions?subscriptionId=${item.id}`,
        metadata: { customerId: item.customerId, remainingDays: item.remainingDays, endDate: item.endDate },
        dedupeKey: copy.dedupeKey
      });
      if (notification) created += 1;
      else skipped += 1;
    }

    await query(
      `INSERT INTO activity_logs (tenant_id, type, title, metadata)
       SELECT id, 'cron.subscription_notifications', 'Subscription notifications checked', $1::jsonb
         FROM tenants`,
      [JSON.stringify({ scanned: subscriptions.rowCount, created, skipped })]
    ).catch(() => null);

    return Response.json({ ok: true, scanned: subscriptions.rowCount, created, skipped });
  } catch (error) {
    console.error("subscription notification cron failed", safeErrorMessage(error));
    return Response.json({ ok: false, error: "Subscription notification cron failed" }, { status: 500 });
  }
}
