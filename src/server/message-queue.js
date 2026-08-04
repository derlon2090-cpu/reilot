import crypto from "node:crypto";
import { normalizeEvolutionPhone } from "../lib/evolution.js";
import { normalizeOptionalEmail, validateOptionalEmail } from "../lib/customerValidation.js";
import { calculateSmartDelaySeconds, riskDisposition, scheduleDelivery } from "../lib/deliveryScheduling.js";
import { PLAN_MESSAGE_LIMIT_REACHED, reserveMessageQuotaWithClient } from "../lib/billing/message-quota.js";
import { query, transaction } from "./db.js";
import { evolutionDelayedSchedule, validateEvolutionMessage } from "./evolution-sending-policy.js";

function digest(parts) {
  return crypto.createHash("sha256").update(parts.map((part) => String(part ?? "")).join("|")).digest("hex");
}

function scheduleSettings(row = {}) {
  return {
    timezone: row.timezone || "Asia/Riyadh",
    allowedStart: String(row.allowed_start || "10:00").slice(0, 5),
    allowedEnd: String(row.allowed_end || "20:30").slice(0, 5),
    autoWhatsAppDelaySeconds: row.auto_whatsapp_delay_seconds,
    manualWhatsAppDelaySeconds: row.manual_whatsapp_delay_seconds,
    jitterMinSeconds: row.jitter_min_seconds,
    jitterMaxSeconds: row.jitter_max_seconds,
    mediumRiskDelaySeconds: row.medium_risk_delay_seconds,
    highRiskDelaySeconds: row.high_risk_delay_seconds,
    fridayEnabled: row.friday_enabled === true
  };
}

export async function enqueueMessage({
  tenantId,
  customerId = null,
  subscriptionId = null,
  customerSubscriptionId = null,
  reminderId = null,
  whatsappChannelId = null,
  templateId = null,
  channelType,
  messageType = "system_notification",
  destination = null,
  emailTo = null,
  subject = null,
  messageBody,
  templateSnapshot = null,
  referenceType = null,
  referenceId = null,
  triggerKey = null,
  priority = 5,
  sourceMode = "automatic",
  maxAttempts = 3,
  enforceConnected = false,
  isBillable = true,
  originalExpiresAt = null,
  fallbackChannel = null,
  fallbackDestination = null,
  fallbackSubject = null,
  fallbackMessageBody = null
}) {
  if (!tenantId || !["whatsapp", "email"].includes(channelType)) {
    return { ok: false, reason: "invalid_queue_request" };
  }
  if (!String(messageBody || "").trim()) return { ok: false, reason: "message_body_required" };

  let normalizedDestination = String(destination || "").trim() || null;
  let normalizedEmail = normalizeOptionalEmail(emailTo);
  if (channelType === "email") {
    const email = validateOptionalEmail(normalizedEmail);
    if (!email.ok || !email.value) return { ok: false, reason: "customer_email_missing" };
    normalizedEmail = email.value;
    normalizedDestination = normalizedEmail;
  }
  if (channelType === "whatsapp") {
    const phone = normalizeEvolutionPhone(normalizedDestination);
    if (!phone.ok) return { ok: false, reason: "customer_phone_missing" };
    normalizedDestination = phone.phoneNumber;
  }

  try {
    return await transaction(async (client) => {
    const context = await client.query(
      `SELECT ss.*, wc.provider AS channel_provider, wc.status AS channel_status, wc.risk_score, wc.health_score, wc.connected_at,
              wc.sending_paused_until, wc.auto_sending_enabled,
              esp.enabled AS evolution_policy_enabled,esp.base_delay_seconds AS evolution_base_delay_seconds,
              esp.jitter_min_seconds AS evolution_jitter_min_seconds,esp.jitter_max_seconds AS evolution_jitter_max_seconds,
              esp.hourly_limit AS evolution_hourly_limit,esp.daily_limit AS evolution_daily_limit,
              esp.duplicate_window_seconds AS evolution_duplicate_window_seconds,
              esp.block_unsafe_links AS evolution_block_unsafe_links,esp.validate_templates AS evolution_validate_templates
         FROM (SELECT $1::uuid AS tenant_id) tenant
         LEFT JOIN sending_schedule_settings ss ON ss.tenant_id = tenant.tenant_id
         LEFT JOIN whatsapp_channels wc ON wc.id = $2 AND wc.tenant_id = tenant.tenant_id
         LEFT JOIN evolution_sending_policies esp ON esp.evolution_device_id=wc.id`,
      [tenantId, whatsappChannelId]
    );
    const row = context.rows[0] || {};
    const isEvolutionAdmin = channelType === "whatsapp" && ["evolution", "evolution_admin"].includes(row.channel_provider);
    if (channelType === "whatsapp") {
      if (!whatsappChannelId) return { ok: false, reason: "whatsapp_not_connected" };
      if (enforceConnected && row.channel_status !== "connected") return { ok: false, reason: "whatsapp_not_connected" };
      if (isEvolutionAdmin) {
        if (sourceMode !== "manual" && row.auto_sending_enabled === false) return { ok: false, reason: "automatic_sending_paused" };
        if (row.sending_paused_until && new Date(row.sending_paused_until) > new Date()) {
          return { ok: false, reason: "sending_temporarily_paused", retryAt: row.sending_paused_until };
        }
        const disposition = riskDisposition(row.risk_score);
        if (disposition.action === "hold") return { ok: false, reason: "critical_risk" };
        if (row.evolution_policy_enabled !== true) return { ok: false, reason: "evolution_policy_disabled" };
        const validation = validateEvolutionMessage({
          destination: normalizedDestination,
          messageBody,
          policy: { blockUnsafeLinks: row.evolution_block_unsafe_links, validateTemplates: row.evolution_validate_templates }
        });
        if (!validation.ok) return validation;
        const counts = await client.query(
          `SELECT count(*) FILTER (WHERE created_at>now()-interval '1 hour')::int AS hourly,
                  count(*) FILTER (WHERE created_at>now()-interval '1 day')::int AS daily
             FROM message_queue
            WHERE whatsapp_channel_id=$1 AND status IN ('pending','processing','sent')`,
          [whatsappChannelId]
        );
        if (Number(counts.rows[0]?.hourly || 0) >= Number(row.evolution_hourly_limit || 20)) return { ok: false, reason: "evolution_hourly_limit" };
        if (Number(counts.rows[0]?.daily || 0) >= Number(row.evolution_daily_limit || 100)) return { ok: false, reason: "evolution_daily_limit" };
      }
    }
    const settings = scheduleSettings(row);
    const isMetaOfficial = channelType === "whatsapp" && ["meta", "meta_cloud", "meta_cloud_api"].includes(row.channel_provider);
    const evolutionSchedule = isEvolutionAdmin ? evolutionDelayedSchedule({
      baseDelaySeconds: row.evolution_base_delay_seconds,
      jitterMinSeconds: row.evolution_jitter_min_seconds,
      jitterMaxSeconds: row.evolution_jitter_max_seconds
    }) : null;
    const delay = isMetaOfficial
      ? { delaySeconds: 0, delayReason: "meta_provider_queue" }
      : isEvolutionAdmin
        ? { delaySeconds: evolutionSchedule.delaySeconds, delayReason: "evolution_device_policy" }
      : calculateSmartDelaySeconds({
        channelType,
        sourceMode,
        messageType,
        riskScore: row.risk_score,
        healthScore: row.health_score,
        connectedAt: row.connected_at,
        settings
      });
    const scheduledFor = isMetaOfficial
      ? new Date()
      : isEvolutionAdmin
        ? evolutionSchedule.scheduledFor
      : scheduleDelivery({ channelType, delaySeconds: delay.delaySeconds, settings });
    const dedupeHash = digest([tenantId, channelType, messageType, normalizedDestination, referenceType, referenceId, messageBody]);
    const duplicate = await client.query(
      `SELECT id FROM message_queue
        WHERE tenant_id = $1 AND dedupe_hash = $2
          AND status IN ('pending', 'processing', 'sent')
          AND created_at > now() - make_interval(secs => $3::int)
        LIMIT 1`,
      [tenantId, dedupeHash, isEvolutionAdmin ? Number(row.evolution_duplicate_window_seconds || 86400) : 86400]
    );
    if (duplicate.rows[0]) return { ok: false, reason: "duplicate_message", queueId: duplicate.rows[0].id };
    const quota = await reserveMessageQuotaWithClient(client, {
      tenantId,
      channelType,
      quantity: 1,
      isBillable
    });
    const inserted = await client.query(
      `INSERT INTO message_queue (
         tenant_id, subscription_id, customer_id, whatsapp_channel_id, template_id,
         scheduled_for, priority, status, max_attempts, trigger_key,
         channel_type, message_type, destination, email_to, subject, message_body, template_snapshot,
         reference_type, reference_id, dedupe_hash, safety_status, delay_seconds, delay_reason,
         is_billable, quota_status, quota_period_id, quota_period_start, quota_period_end, quota_reserved_at,
         customer_subscription_id, reminder_id, original_expires_at, fallback_channel,
         fallback_destination, fallback_subject, fallback_message_body
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,'pending',$20,$21,
                 $22,$23,$24,$25,$26,CASE WHEN $23 = 'reserved' THEN now() ELSE NULL END,
                 $27,$28,$29,$30,$31,$32,$33)
       RETURNING id, scheduled_for AS "scheduledFor"`,
      [tenantId, subscriptionId, customerId, whatsappChannelId, templateId, scheduledFor, priority,
        maxAttempts, triggerKey, channelType, messageType, normalizedDestination, normalizedEmail,
        subject, String(messageBody).trim(), templateSnapshot ? JSON.stringify(templateSnapshot) : null, referenceType, referenceId, dedupeHash,
        delay.delaySeconds, delay.delayReason, Boolean(isBillable), quota.quotaStatus,
        quota.periodId || null, quota.periodStart || null, quota.periodEnd || null,
        customerSubscriptionId, reminderId, originalExpiresAt, fallbackChannel, fallbackDestination,
        fallbackSubject, fallbackMessageBody]
    );
    return { ok: true, queueId: inserted.rows[0].id, scheduledFor: inserted.rows[0].scheduledFor, usage: quota.usage || null, ...delay };
    });
  } catch (error) {
    if (error?.code === PLAN_MESSAGE_LIMIT_REACHED) {
      return { ok: false, reason: PLAN_MESSAGE_LIMIT_REACHED, code: PLAN_MESSAGE_LIMIT_REACHED, usage: error.usage };
    }
    throw error;
  }
}

export async function queueOrderInformationLink({ tenantId, userId, link, method, whatsappChannelId = null }) {
  const text = `مرحبًا ${link.customerName || "عميلنا"}،\nيمكنك عرض معلومات طلبك ومدة اشتراكك من خلال الرابط التالي:\n${link.publicUrl}\n\nشكرًا لك،\n${link.storeName}`;
  const queued = await enqueueMessage({
    tenantId,
    customerId: link.customerId,
    subscriptionId: link.subscriptionId,
    whatsappChannelId,
    channelType: method,
    messageType: "manual_order_link",
    destination: method === "whatsapp" ? link.phoneNumber : link.email,
    emailTo: method === "email" ? link.email : null,
    subject: method === "email" ? `معلومات الطلب #${link.orderNumber} - ${link.storeName}` : null,
    messageBody: text,
    templateSnapshot: method === "email" ? {
      type: "order_information_email_v1",
      data: {
        customerName: link.customerName,
        storeName: link.storeName,
        storeImageUrl: link.logoUrl || "",
        storeImageRadius: Number(link.logoBorderRadius ?? 16),
        orderNumber: link.orderNumber,
        publicUrl: link.publicUrl,
        locale: "ar"
      }
    } : null,
    referenceType: "order_info_link",
    referenceId: link.id,
    triggerKey: `${tenantId}:order-link:${link.id}:${method}`,
    sourceMode: "manual",
    enforceConnected: method === "whatsapp"
  });
  if (!queued.ok) return queued;
  await query(
    `INSERT INTO activity_logs (tenant_id, user_id, customer_id, type, title, metadata)
     VALUES ($1, $2, $3, 'order_link.queued', 'Order information link queued', $4::jsonb)`,
    [tenantId, userId, link.customerId, JSON.stringify({ linkId: link.id, method, queueId: queued.queueId })]
  );
  return queued;
}
