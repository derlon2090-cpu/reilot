import { transaction } from "../../server/db.js";

export const PLAN_MESSAGE_LIMIT_REACHED = "PLAN_MESSAGE_LIMIT_REACHED";

export class MessageQuotaError extends Error {
  constructor(usage) {
    const channelLabel = usage?.selectedChannel === "email"
      ? "رسائل البريد الإلكتروني"
      : usage?.selectedChannel === "sms"
        ? "الرسائل النصية"
        : "هذه القناة";
    super(`وصلت إلى الحد الشهري لـ ${channelLabel} في باقتك.`);
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

function channelReservedColumn(channelType) {
  if (channelType === "whatsapp") return "whatsapp_reserved";
  if (channelType === "email") return "email_reserved";
  if (channelType === "sms") return "sms_reserved";
  throw new Error("Unsupported message channel");
}

function channelLimitColumn(channelType) {
  if (channelType === "whatsapp") return "whatsapp_message_limit";
  if (channelType === "email") return "email_message_limit";
  if (channelType === "sms") return "sms_message_limit";
  throw new Error("Unsupported message channel");
}

function calculateChannelUsage(row, channelType) {
  const usedColumn = channelColumn(channelType);
  const reservedColumn = channelReservedColumn(channelType);
  const limitColumn = channelLimitColumn(channelType);
  const fallbackLimit = channelType === "email" ? number(row.message_limit) : channelType === "whatsapp" ? -1 : 0;
  const limitValue = row[limitColumn] === null || row[limitColumn] === undefined
    ? fallbackLimit
    : number(row[limitColumn]);
  const used = number(row[usedColumn]);
  const reserved = number(row[reservedColumn]);
  const consumed = used + reserved;
  const unlimited = limitValue === -1;
  const remaining = unlimited ? -1 : Math.max(0, limitValue - consumed);
  const percentage = unlimited ? null : limitValue > 0
    ? Math.min(100, Math.round((consumed / limitValue) * 100))
    : consumed > 0 ? 100 : 0;
  return {
    channel: channelType,
    limit: limitValue,
    used,
    reserved,
    consumed,
    remaining,
    percentage,
    unlimited,
    isNearLimit: !unlimited && percentage >= 80,
    isLimitReached: !unlimited && remaining <= 0
  };
}

export function calculateMessageUsage(row) {
  const channels = {
    whatsapp: calculateChannelUsage(row, "whatsapp"),
    email: calculateChannelUsage(row, "email"),
    sms: calculateChannelUsage(row, "sms")
  };
  // The legacy top-level fields intentionally describe email. Renvix plans
  // limit email, while official WhatsApp is billed from its own wallet.
  const primary = channels.email;
  return {
    periodId: row.id,
    platformSubscriptionId: row.platform_subscription_id,
    planId: row.plan_id,
    planName: row.plan_name,
    planSlug: row.plan_slug,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    limit: primary.limit,
    used: primary.used,
    reserved: primary.reserved,
    consumed: primary.consumed,
    remaining: primary.remaining,
    percentage: primary.percentage,
    unlimited: primary.unlimited,
    isNearLimit: primary.isNearLimit,
    isLimitReached: primary.isLimitReached,
    totalUsed: number(row.used_messages),
    totalReserved: number(row.reserved_messages),
    channels,
    byChannel: {
      whatsapp: channels.whatsapp.used,
      email: channels.email.used,
      sms: channels.sms.used
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

async function notifyForUsage(client, tenantId, period, channelType = null) {
  const usage = calculateMessageUsage(period);
  const channels = channelType ? [channelType] : ["email", "sms"];
  for (const channel of channels) {
    const channelUsage = usage.channels[channel];
    if (!channelUsage || channelUsage.unlimited || channelUsage.limit <= 0) continue;
    const channelLabel = channel === "email" ? "البريد الإلكتروني" : "الرسائل النصية";
    if (channelUsage.isLimitReached) {
    await insertNotification(client, {
      tenantId,
      type: "message_usage_limit_reached",
      title: `تم استهلاك حد ${channelLabel}`,
      message: `لن يتم إرسال رسائل جديدة عبر ${channelLabel} حتى ترقية الباقة أو بدء دورة جديدة.`,
      priority: "critical",
      period,
      threshold: `${channel}:100_percent`
    });
    } else if (channelUsage.percentage >= 80) {
    await insertNotification(client, {
      tenantId,
      type: "message_usage_near_limit",
      title: `اقتربت من حد ${channelLabel}`,
      message: `استخدمت أو حجزت ${channelUsage.consumed} من أصل ${channelUsage.limit} رسالة.`,
      priority: "high",
      period,
      threshold: `${channel}:80_percent`
    });
    }
  }
}

async function currentSubscription(client, tenantId) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [tenantId]);
  let result = await client.query(
    `SELECT ps.id, ps.plan_id, ps.current_period_start, ps.current_period_end,
            ps.status, pp.name AS plan_name, pp.slug AS plan_slug,
            pp.monthly_message_limit, pp.whatsapp_message_limit,
            pp.email_message_limit, pp.sms_message_limit
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
    `SELECT id, name, slug, monthly_message_limit, whatsapp_message_limit,
            email_message_limit, sms_message_limit
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
  return {
    ...result.rows[0],
    plan_name: free.rows[0].name,
    plan_slug: free.rows[0].slug,
    monthly_message_limit: free.rows[0].monthly_message_limit,
    whatsapp_message_limit: free.rows[0].whatsapp_message_limit,
    email_message_limit: free.rows[0].email_message_limit,
    sms_message_limit: free.rows[0].sms_message_limit
  };
}

export async function getOrCreateUsagePeriodWithClient(client, tenantId) {
  const subscription = await currentSubscription(client, tenantId);
  const upserted = await client.query(
    `INSERT INTO message_usage_periods (
       tenant_id, platform_subscription_id, plan_id, period_start, period_end,
       message_limit, whatsapp_message_limit, email_message_limit, sms_message_limit
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (tenant_id, period_start, period_end) DO UPDATE SET
       platform_subscription_id = EXCLUDED.platform_subscription_id,
       plan_id = EXCLUDED.plan_id,
       message_limit = EXCLUDED.message_limit,
       whatsapp_message_limit = EXCLUDED.whatsapp_message_limit,
       email_message_limit = EXCLUDED.email_message_limit,
       sms_message_limit = EXCLUDED.sms_message_limit,
       updated_at = now()
     RETURNING *, (xmax = 0) AS inserted`,
    [tenantId, subscription.id, subscription.plan_id, subscription.current_period_start,
      subscription.current_period_end, number(subscription.email_message_limit ?? subscription.monthly_message_limit),
      subscription.whatsapp_message_limit === null ? -1 : number(subscription.whatsapp_message_limit),
      number(subscription.email_message_limit ?? subscription.monthly_message_limit),
      number(subscription.sms_message_limit)]
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
  const reservedColumn = channelReservedColumn(channelType);
  if (!isBillable) return { billable: false, quotaStatus: "not_billable", quantity: requested };
  const period = await getOrCreateUsagePeriodWithClient(client, tenantId);
  const before = calculateMessageUsage(period);
  const channelUsage = before.channels[channelType];
  if (!channelUsage.unlimited && channelUsage.remaining < requested) {
    await notifyForUsage(client, tenantId, period, channelType);
    const errorUsage = { ...before, ...channelUsage, selectedChannel: channelType };
    throw new MessageQuotaError(errorUsage);
  }
  const updated = await client.query(
    `UPDATE message_usage_periods
        SET reserved_messages = reserved_messages + $2,
            ${reservedColumn} = ${reservedColumn} + $2,
            updated_at = now()
      WHERE id = $1 RETURNING *`,
    [period.id, requested]
  );
  const row = { ...updated.rows[0], plan_name: period.plan_name, plan_slug: period.plan_slug };
  await notifyForUsage(client, tenantId, row, channelType);
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
  const reservedColumn = channelReservedColumn(channelType);
  const updated = await client.query(
    `UPDATE message_usage_periods
        SET reserved_messages = GREATEST(0, reserved_messages - $2),
            ${reservedColumn} = GREATEST(0, ${reservedColumn} - $2),
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
  await notifyForUsage(client, updated.rows[0].tenant_id, updated.rows[0], channelType);
  return { changed: true, usage: calculateMessageUsage(updated.rows[0]) };
}

export function consumeReservedQuota(input) {
  return transaction((client) => consumeReservedQuotaWithClient(client, input));
}

export async function releaseReservedQuotaWithClient(client, input) {
  const reservation = await lockedReservation(client, input);
  if (!reservation || (input.queueId && reservation.quota_status !== "reserved")) return { changed: false };
  const quantity = Math.max(1, Math.trunc(number(input.quantity || 1)));
  const channelType = input.channelType || reservation.channel_type;
  const reservedColumn = channelReservedColumn(channelType);
  const updated = await client.query(
    `UPDATE message_usage_periods
        SET reserved_messages = GREATEST(0, reserved_messages - $2),
            ${reservedColumn} = GREATEST(0, ${reservedColumn} - $2),
            updated_at = now()
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
  const channelType = input.channelType || "email";
  const channelUsage = usage.channels[channelType];
  if (!channelUsage.unlimited && channelUsage.remaining < quantity) {
    throw new MessageQuotaError({ ...usage, ...channelUsage, selectedChannel: channelType });
  }
  return { ...usage, selectedChannel: channelType };
}

export async function getRemainingMessages(tenantId, channelType = "email") {
  return (await getCurrentMessageUsage(tenantId)).channels[channelType].remaining;
}
