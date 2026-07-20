import { transaction } from "../../server/db.js";

export const PLAN_MESSAGE_LIMIT_REACHED = "PLAN_MESSAGE_LIMIT_REACHED";

export class MessageQuotaError extends Error {
  constructor(usage) {
    super("وصلت إلى الحد الشهري لرسائل باقتك.");
    this.name = "MessageQuotaError";
    this.code = PLAN_MESSAGE_LIMIT_REACHED;
    this.status = 409;
    this.usage = usage;
  }
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function channelColumn(channelType) {
  if (channelType === "whatsapp") return "whatsapp_used";
  if (channelType === "email") return "email_used";
  if (channelType === "sms") return "sms_used";
  throw new Error("Unsupported message channel");
}

export function calculateMessageUsage(row) {
  const limit = number(row.message_limit);
  const used = number(row.used_messages);
  const reserved = number(row.reserved_messages);
  const consumed = used + reserved;
  const unlimited = limit === -1;
  const remaining = unlimited ? -1 : Math.max(0, limit - consumed);
  const percentage = unlimited ? null : limit > 0 ? Math.min(100, Math.round((consumed / limit) * 100)) : 100;
  return {
    periodId: row.id,
    platformSubscriptionId: row.platform_subscription_id,
    planId: row.plan_id,
    planName: row.plan_name,
    planSlug: row.plan_slug,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    limit,
    used,
    reserved,
    consumed,
    remaining,
    percentage,
    unlimited,
    isNearLimit: !unlimited && percentage >= 80,
    isLimitReached: !unlimited && remaining <= 0,
    byChannel: {
      whatsapp: number(row.whatsapp_used),
      email: number(row.email_used),
      sms: number(row.sms_used)
    }
  };
}

async function insertNotification(client, { tenantId, type, title, message, priority, period, threshold }) {
  const periodKey = new Date(period.period_start).toISOString();
  await client.query(
    `INSERT INTO in_app_notifications (
       tenant_id, type, title, message, entity_type, entity_id,
       priority, action_url, metadata, dedupe_key
     ) VALUES ($1,$2,$3,$4,'message_usage',$5,$6,'/dashboard/billing',$7::jsonb,$8)
     ON CONFLICT (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
    [tenantId, type, title, message, period.id, priority,
      JSON.stringify({ periodStart: period.period_start, periodEnd: period.period_end, threshold }),
      `usage:${tenantId}:${periodKey}:${threshold}`]
  );
}

async function notifyForUsage(client, tenantId, period) {
  const usage = calculateMessageUsage(period);
  if (usage.unlimited) return;
  if (usage.isLimitReached) {
    await insertNotification(client, {
      tenantId,
      type: "message_usage_limit_reached",
      title: "تم استهلاك حد الرسائل",
      message: "لن يتم إرسال رسائل جديدة حتى ترقية الباقة أو بدء دورة جديدة.",
      priority: "critical",
      period,
      threshold: "100_percent"
    });
  } else if (usage.percentage >= 80) {
    await insertNotification(client, {
      tenantId,
      type: "message_usage_near_limit",
      title: "اقتربت من حد رسائل باقتك",
      message: `استخدمت أو حجزت ${usage.consumed} من أصل ${usage.limit} رسالة.`,
      priority: "high",
      period,
      threshold: "80_percent"
    });
  }
}

async function currentSubscription(client, tenantId) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [tenantId]);
  let result = await client.query(
    `SELECT ps.id, ps.plan_id, ps.current_period_start, ps.current_period_end,
            ps.status, pp.name AS plan_name, pp.slug AS plan_slug,
            pp.monthly_message_limit
       FROM platform_subscriptions ps
       JOIN platform_plans pp ON pp.id = ps.plan_id
      WHERE ps.tenant_id = $1
        AND ps.status IN ('active', 'trial', 'past_due')
        AND ps.current_period_end > now()
      ORDER BY CASE ps.status WHEN 'active' THEN 0 WHEN 'trial' THEN 1 ELSE 2 END,
               ps.created_at DESC
      FOR UPDATE OF ps
      LIMIT 1`,
    [tenantId]
  );
  if (result.rows[0]) return result.rows[0];

  const free = await client.query(
    `SELECT id, name, slug, monthly_message_limit
       FROM platform_plans
      WHERE slug IN ('free', 'trial') AND is_active = true
      ORDER BY CASE slug WHEN 'free' THEN 0 ELSE 1 END LIMIT 1`
  );
  if (!free.rows[0]) throw new Error("No active free platform plan is configured");
  result = await client.query(
    `INSERT INTO platform_subscriptions (
       tenant_id, plan_id, status, billing_cycle, current_period_start, current_period_end
     ) VALUES ($1,$2,'active','monthly',now(),now() + interval '1 month')
     RETURNING id, plan_id, current_period_start, current_period_end, status`,
    [tenantId, free.rows[0].id]
  );
  return { ...result.rows[0], plan_name: free.rows[0].name, plan_slug: free.rows[0].slug, monthly_message_limit: free.rows[0].monthly_message_limit };
}

export async function getOrCreateUsagePeriodWithClient(client, tenantId) {
  const subscription = await currentSubscription(client, tenantId);
  const upserted = await client.query(
    `INSERT INTO message_usage_periods (
       tenant_id, platform_subscription_id, plan_id, period_start, period_end, message_limit
     ) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tenant_id, period_start, period_end) DO UPDATE SET
       platform_subscription_id = EXCLUDED.platform_subscription_id,
       plan_id = EXCLUDED.plan_id,
       message_limit = EXCLUDED.message_limit,
       updated_at = now()
     RETURNING *, (xmax = 0) AS inserted`,
    [tenantId, subscription.id, subscription.plan_id, subscription.current_period_start,
      subscription.current_period_end, number(subscription.monthly_message_limit)]
  );
  const period = { ...upserted.rows[0], plan_name: subscription.plan_name, plan_slug: subscription.plan_slug };
  if (period.inserted) {
    const previous = await client.query(
      "SELECT 1 FROM message_usage_periods WHERE tenant_id = $1 AND id <> $2 LIMIT 1",
      [tenantId, period.id]
    );
    if (previous.rows[0]) {
      await insertNotification(client, {
        tenantId,
        type: "message_usage_reset",
        title: "بدأت دورة رسائل جديدة",
        message: "تمت إعادة تعيين استخدام الرسائل حسب باقتك الحالية.",
        priority: "normal",
        period,
        threshold: "reset"
      });
    }
  }
  return period;
}

export async function getCurrentMessageUsageWithClient(client, tenantId) {
  const period = await getOrCreateUsagePeriodWithClient(client, tenantId);
  await notifyForUsage(client, tenantId, period);
  return calculateMessageUsage(period);
}

export function getCurrentMessageUsage(tenantId) {
  return transaction((client) => getCurrentMessageUsageWithClient(client, tenantId));
}

export async function reserveMessageQuotaWithClient(client, {
  tenantId,
  channelType,
  quantity = 1,
  isBillable = true
}) {
  const requested = Math.max(1, Math.trunc(number(quantity)));
  channelColumn(channelType);
  if (!isBillable) return { billable: false, quotaStatus: "not_billable", quantity: requested };
  const period = await getOrCreateUsagePeriodWithClient(client, tenantId);
  const before = calculateMessageUsage(period);
  if (!before.unlimited && before.remaining < requested) {
    await notifyForUsage(client, tenantId, period);
    throw new MessageQuotaError(before);
  }
  const updated = await client.query(
    `UPDATE message_usage_periods
        SET reserved_messages = reserved_messages + $2, updated_at = now()
      WHERE id = $1 RETURNING *`,
    [period.id, requested]
  );
  const row = { ...updated.rows[0], plan_name: period.plan_name, plan_slug: period.plan_slug };
  await notifyForUsage(client, tenantId, row);
  return {
    billable: true,
    quotaStatus: "reserved",
    quantity: requested,
    periodId: row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    usage: calculateMessageUsage(row)
  };
}

export function reserveMessageQuota(input) {
  return transaction((client) => reserveMessageQuotaWithClient(client, input));
}

async function lockedReservation(client, { queueId = null, periodId = null }) {
  if (queueId) {
    const queued = await client.query(
      `SELECT id, tenant_id, channel_type, quota_status, quota_period_id
         FROM message_queue WHERE id = $1 FOR UPDATE`,
      [queueId]
    );
    if (!queued.rows[0]) return null;
    return { ...queued.rows[0], periodId: queued.rows[0].quota_period_id };
  }
  if (!periodId) throw new Error("A queueId or periodId is required");
  return { periodId };
}

export async function consumeReservedQuotaWithClient(client, input) {
  const reservation = await lockedReservation(client, input);
  if (!reservation || (input.queueId && reservation.quota_status !== "reserved")) return { changed: false };
  const quantity = Math.max(1, Math.trunc(number(input.quantity || 1)));
  const channelType = input.channelType || reservation.channel_type;
  const column = channelColumn(channelType);
  const updated = await client.query(
    `UPDATE message_usage_periods
        SET reserved_messages = GREATEST(0, reserved_messages - $2),
            used_messages = used_messages + $2,
            ${column} = ${column} + $2,
            last_consumed_at = now(), updated_at = now()
      WHERE id = $1 RETURNING *`,
    [reservation.periodId, quantity]
  );
  if (!updated.rows[0]) throw new Error("Reserved usage period was not found");
  if (input.queueId) {
    await client.query(
      `UPDATE message_queue SET quota_status = 'consumed', quota_consumed_at = now(), updated_at = now()
        WHERE id = $1 AND quota_status = 'reserved'`,
      [input.queueId]
    );
  }
  await notifyForUsage(client, updated.rows[0].tenant_id, updated.rows[0]);
  return { changed: true, usage: calculateMessageUsage(updated.rows[0]) };
}

export function consumeReservedQuota(input) {
  return transaction((client) => consumeReservedQuotaWithClient(client, input));
}

export async function releaseReservedQuotaWithClient(client, input) {
  const reservation = await lockedReservation(client, input);
  if (!reservation || (input.queueId && reservation.quota_status !== "reserved")) return { changed: false };
  const quantity = Math.max(1, Math.trunc(number(input.quantity || 1)));
  const updated = await client.query(
    `UPDATE message_usage_periods
        SET reserved_messages = GREATEST(0, reserved_messages - $2), updated_at = now()
      WHERE id = $1 RETURNING *`,
    [reservation.periodId, quantity]
  );
  if (input.queueId) {
    await client.query(
      `UPDATE message_queue SET quota_status = 'released', quota_released_at = now(), updated_at = now()
        WHERE id = $1 AND quota_status = 'reserved'`,
      [input.queueId]
    );
  }
  return { changed: Boolean(updated.rows[0]), usage: updated.rows[0] ? calculateMessageUsage(updated.rows[0]) : null };
}

export function releaseReservedQuota(input) {
  return transaction((client) => releaseReservedQuotaWithClient(client, input));
}

export async function assertMessageQuotaAvailable(input) {
  const usage = await getCurrentMessageUsage(input.tenantId);
  const quantity = Math.max(1, Math.trunc(number(input.quantity || 1)));
  if (!usage.unlimited && usage.remaining < quantity) throw new MessageQuotaError(usage);
  return usage;
}

export async function getRemainingMessages(tenantId) {
  return (await getCurrentMessageUsage(tenantId)).remaining;
}
