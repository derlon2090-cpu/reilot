import { canSendSafely, warmupDailyLimit, whatsappHealthScore } from "../lib/messageSafety.js";
import { nextSendingWindow, riskDisposition } from "../lib/deliveryScheduling.js";
import {
  PLAN_MESSAGE_LIMIT_REACHED,
  consumeReservedQuotaWithClient,
  getCurrentMessageUsage,
  releaseReservedQuotaWithClient,
  reserveMessageQuotaWithClient
} from "../lib/billing/message-quota.js";
import { query, transaction } from "./db.js";
import { sendQueuedEmail } from "./email/resend.service.js";
import { evolutionConnectionState, evolutionSendText } from "./evolution-client.js";
import { enqueueMessage } from "./message-queue.js";
import { safeErrorMessage } from "./security.js";
import { runDueSubscriptionReminders } from "./renewal-reminders.js";

export async function runRenewalReminders() {
  return runDueSubscriptionReminders();
}

async function whatsappSafety(client, item) {
  const result = await client.query(
    `SELECT wc.status AS channel_status, wc.daily_sent, wc.hourly_sent, wc.failure_rate,
            wc.risk_score, wc.warmup_day, wc.auto_sending_enabled, wc.sending_paused_until,
            COALESCE(ws.safe_mode_enabled, true) AS safe_mode_enabled,
            COALESCE(ws.daily_message_limit, 100) AS daily_message_limit,
            COALESCE(ws.hourly_message_limit, 20) AS hourly_message_limit,
            COALESCE(ws.quiet_hours_start, '21:00'::time) AS quiet_hours_start,
            COALESCE(ws.quiet_hours_end, '09:00'::time) AS quiet_hours_end,
            COALESCE(ws.max_fail_rate_percent, 20) AS max_fail_rate_percent,
            COALESCE(ws.max_block_risk_score, 70) AS max_block_risk_score,
            EXISTS(SELECT 1 FROM unsubscribe_list ul
                    WHERE ul.tenant_id = item.tenant_id
                      AND regexp_replace(ul.phone_number, '[^0-9]', '', 'g') = item.destination) AS unsubscribed,
            EXISTS(SELECT 1 FROM notification_logs nl
                    WHERE nl.tenant_id = item.tenant_id
                      AND regexp_replace(COALESCE(nl.to_number, ''), '[^0-9]', '', 'g') = item.destination
                      AND nl.message_body = item.message_body
                      AND nl.created_at > now() - interval '24 hours') AS duplicate
       FROM message_queue item
       JOIN whatsapp_channels wc ON wc.id = item.whatsapp_channel_id AND wc.tenant_id = item.tenant_id
       LEFT JOIN whatsapp_safety_settings ws ON ws.tenant_id = item.tenant_id
      WHERE item.id = $1`,
    [item.id]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: "channel_disconnected" };
  if (row.sending_paused_until && new Date(row.sending_paused_until) > new Date()) {
    return { ok: false, reason: "sending_temporarily_paused", retryAt: row.sending_paused_until };
  }
  if (row.auto_sending_enabled === false && item.message_type !== "manual_order_link") {
    return { ok: false, reason: "automatic_sending_paused" };
  }
  return canSendSafely({
    safeModeEnabled: row.safe_mode_enabled,
    hourlySent: Number(row.hourly_sent || 0),
    dailySent: Number(row.daily_sent || 0),
    hourlyLimit: Math.min(Number(row.hourly_message_limit || 20), warmupDailyLimit(row.warmup_day)),
    dailyLimit: Math.min(Number(row.daily_message_limit || 100), warmupDailyLimit(row.warmup_day)),
    quietHoursStart: String(row.quiet_hours_start).slice(0, 5),
    quietHoursEnd: String(row.quiet_hours_end).slice(0, 5),
    unsubscribed: row.unsubscribed,
    duplicateWithinWindow: row.duplicate,
    failRatePercent: Number(row.failure_rate || 0),
    maxFailRatePercent: Number(row.max_fail_rate_percent || 20),
    riskScore: Number(row.risk_score || 0),
    maxBlockRiskScore: Number(row.max_block_risk_score || 70),
    channelStatus: row.channel_status
  });
}

async function pauseRiskyChannel(item) {
  const risk = riskDisposition(item.risk_score);
  if (!["pause", "hold"].includes(risk.action)) return false;
  const retryAt = risk.action === "hold" ? null : new Date(Date.now() + risk.delaySeconds * 1000);
  await transaction(async (client) => {
    await client.query(
      `UPDATE whatsapp_channels
          SET status = CASE WHEN $3 = 'hold' THEN 'risk_hold' ELSE status END,
              auto_sending_enabled = false, risk_hold_at = now(), risk_hold_reason = $4,
              sending_paused_until = $2, sending_pause_reason = $4, updated_at = now()
        WHERE id = $1`,
      [item.whatsapp_channel_id, retryAt, risk.action, risk.reason]
    );
    await client.query(
      `UPDATE message_queue
          SET status = 'pending', safety_status = 'paused', safety_reason = $2,
              scheduled_for = COALESCE($3, now() + interval '24 hours'), updated_at = now()
        WHERE whatsapp_channel_id = $1 AND channel_type = 'whatsapp' AND status IN ('pending', 'processing')`,
      [item.whatsapp_channel_id, risk.reason, retryAt]
    );
    await client.query(
      `INSERT INTO whatsapp_risk_events
         (tenant_id, whatsapp_channel_id, event_type, risk_score, severity, action_taken, message_queue_id, reason, details)
       VALUES ($1, $2, 'blocked_or_failed_status', $3, 'critical', $4, $5, $6, $7::jsonb)`,
      [item.tenant_id, item.whatsapp_channel_id, Number(item.risk_score || 0), risk.action,
        item.id, risk.reason, JSON.stringify({ queueId: item.id, retryAt })]
    );
  });
  return true;
}

async function markSent(item, providerMessageId) {
  await transaction(async (client) => {
    const updated = await client.query(
      `UPDATE message_queue SET status = 'sent', safety_status = 'passed', attempts = attempts + 1,
              provider_message_id = $2, sent_at = COALESCE(sent_at,now()), last_error = NULL,
              billing_status = CASE WHEN is_billable THEN 'charged' ELSE 'not_billable' END, updated_at = now()
        WHERE id = $1 AND status <> 'sent' RETURNING id`,
      [item.id, providerMessageId]
    );
    if (!updated.rows[0]) return;
    await client.query(
      `INSERT INTO notification_logs
         (tenant_id, customer_id, subscription_id, whatsapp_channel_id, channel, to_number,
          message_type, message_body, provider_message_id, status, trigger_key, sent_at,
          customer_subscription_id, reminder_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'sent',$10,now(),$11,$12)`,
      [item.tenant_id, item.customer_id, item.subscription_id, item.whatsapp_channel_id,
        item.channel_type, item.destination, item.message_type, item.message_body,
        providerMessageId, item.trigger_key, item.customer_subscription_id, item.reminder_id]
    );
    if (item.channel_type === "email") {
      await client.query(
        `INSERT INTO email_logs
           (tenant_id, customer_id, to_email, subject, body, provider_message_id, status, sent_at)
         VALUES ($1,$2,$3,$4,$5,$6,'sent',now())`,
        [item.tenant_id, item.customer_id, item.email_to, item.subject || "إشعار من Renvix", item.message_body, providerMessageId]
      );
    }
    if (item.channel_type === "whatsapp") {
      await client.query(
        `UPDATE whatsapp_channels
            SET daily_sent = daily_sent + 1, hourly_sent = hourly_sent + 1,
                consecutive_failures = 0, last_successful_send_at = now(), last_send_at = now(), updated_at = now()
          WHERE id = $1`,
        [item.whatsapp_channel_id]
      );
    }
    if (item.is_billable !== false) {
      const charged = await client.query(
        `INSERT INTO balance_transactions (tenant_id,message_id,type,amount,reason,idempotency_key)
         VALUES ($1,$2,'debit',1,'successful_message_send',$3)
         ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
        [item.tenant_id, item.id, `message:${item.id}:send-charge`]
      );
      if (charged.rows[0]) await consumeReservedQuotaWithClient(client, { queueId: item.id });
    }
    if (item.customer_subscription_id) await client.query(
      `UPDATE customer_subscriptions SET last_reminder_sent_at=now(),last_reminder_channel=$2,
       last_reminder_message_id=$3,notification_status='sent',updated_at=now() WHERE id=$1`,
      [item.customer_subscription_id, item.channel_type, item.id]
    );
    if (item.reminder_id) await client.query(
      "UPDATE subscription_reminders SET status='sent',sent_at=now(),failure_reason=NULL,updated_at=now() WHERE id=$1",
      [item.reminder_id]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id, customer_id, type, title, metadata)
       VALUES ($1,$2,'message.sent','Message sent from secure queue',$3::jsonb)`,
      [item.tenant_id, item.customer_id, JSON.stringify({ queueId: item.id, channel: item.channel_type, providerMessageId })]
    );
  });
}

async function markFailed(item, error) {
  const lastError = safeErrorMessage(error);
  const nextStatus = Number(item.attempts || 0) + 1 >= Number(item.max_attempts || 3) ? "failed" : "pending";
  await transaction(async (client) => {
    await client.query(
      `UPDATE message_queue
          SET status = $2, attempts = attempts + 1, last_error = $3, safety_status = 'failed',
              failed_at = CASE WHEN $2='failed' THEN now() ELSE failed_at END, failure_code=$3,
              scheduled_for = now() + (power(2, attempts + 1)::text || ' minutes')::interval, updated_at = now()
        WHERE id = $1`,
      [item.id, nextStatus, lastError]
    );
    if (nextStatus === "failed") await releaseReservedQuotaWithClient(client, { queueId: item.id });
    if (nextStatus === "failed" && item.reminder_id) await client.query(
      "UPDATE subscription_reminders SET status='failed',failed_at=now(),failure_reason=$2,updated_at=now() WHERE id=$1",
      [item.reminder_id, lastError]
    );
    if (item.channel_type === "whatsapp" && item.whatsapp_channel_id) {
      await client.query(
        `UPDATE whatsapp_channels SET consecutive_failures = consecutive_failures + 1,
                last_failed_send_at = now(), last_send_at = now(), last_error = $2, updated_at = now()
          WHERE id = $1`,
        [item.whatsapp_channel_id, lastError]
      );
    }
  });
  return nextStatus;
}

async function reminderStillCurrent(item) {
  if (item.message_type !== "renewal_reminder" || !item.customer_subscription_id) return { ok: true };
  const result = await query(
    `SELECT cs.status,cs.expires_at,sr.status AS reminder_status
       FROM customer_subscriptions cs LEFT JOIN subscription_reminders sr ON sr.id=$2
      WHERE cs.id=$1 LIMIT 1`,
    [item.customer_subscription_id, item.reminder_id]
  );
  const row = result.rows[0];
  if (!row || row.status !== "active") return { ok: false, reason: "subscription_not_active" };
  if (item.original_expires_at && new Date(row.expires_at).getTime() !== new Date(item.original_expires_at).getTime()) return { ok: false, reason: "subscription_was_renewed" };
  if (item.reminder_id && ["cancelled", "skipped", "sent"].includes(row.reminder_status)) return { ok: false, reason: "reminder_not_sendable" };
  return { ok: true };
}

async function skipStaleReminder(item, reason) {
  await transaction(async (client) => {
    await client.query("UPDATE message_queue SET status='skipped',safety_status='blocked',safety_reason=$2,last_error=$2,updated_at=now() WHERE id=$1", [item.id, reason]);
    await releaseReservedQuotaWithClient(client, { queueId: item.id });
    if (item.reminder_id) await client.query("UPDATE subscription_reminders SET status='skipped',failure_reason=$2,updated_at=now() WHERE id=$1", [item.reminder_id, reason]);
  });
}

async function enqueueFallback(item) {
  if (!item.fallback_channel || !item.fallback_destination || !item.fallback_message_body) return false;
  const result = await enqueueMessage({
    tenantId: item.tenant_id,
    customerId: item.customer_id,
    customerSubscriptionId: item.customer_subscription_id,
    reminderId: item.reminder_id,
    channelType: item.fallback_channel,
    messageType: item.message_type,
    destination: item.fallback_destination,
    emailTo: item.fallback_channel === "email" ? item.fallback_destination : null,
    subject: item.fallback_subject,
    messageBody: item.fallback_message_body,
    referenceType: item.reference_type,
    referenceId: item.reference_id,
    triggerKey: `fallback:${item.id}`,
    sourceMode: "automatic",
    originalExpiresAt: item.original_expires_at
  });
  return result.ok;
}

export async function runMessageRetry() {
  const items = await transaction(async (client) => {
    const locked = await client.query(
      `SELECT mq.*, wc.instance_name, wc.risk_score
         FROM message_queue mq
         LEFT JOIN whatsapp_channels wc ON wc.id = mq.whatsapp_channel_id
        WHERE mq.status = 'pending' AND mq.scheduled_for <= now()
        ORDER BY mq.priority, mq.scheduled_for
        FOR UPDATE OF mq SKIP LOCKED LIMIT 20`
    );
    const ready = [];
    const ordered = [...locked.rows].sort((a, b) => String(a.tenant_id).localeCompare(String(b.tenant_id)));
    for (const item of ordered) {
      if (item.is_billable === false && item.quota_status !== "not_billable") {
        await client.query("UPDATE message_queue SET quota_status = 'not_billable', updated_at = now() WHERE id = $1", [item.id]);
      } else if (item.is_billable !== false && item.quota_status === "not_reserved") {
        try {
          const quota = await reserveMessageQuotaWithClient(client, {
            tenantId: item.tenant_id,
            channelType: item.channel_type,
            quantity: 1,
            isBillable: true
          });
          await client.query(
            `UPDATE message_queue
                SET quota_status = 'reserved', quota_period_id = $2,
                    quota_period_start = $3, quota_period_end = $4,
                    quota_reserved_at = now(), updated_at = now()
              WHERE id = $1`,
            [item.id, quota.periodId, quota.periodStart, quota.periodEnd]
          );
        } catch (error) {
          if (error?.code !== PLAN_MESSAGE_LIMIT_REACHED) throw error;
          await client.query(
            `UPDATE message_queue
                SET status = 'skipped', safety_status = 'blocked', safety_reason = $2,
                    last_error = $2, updated_at = now()
              WHERE id = $1`,
            [item.id, PLAN_MESSAGE_LIMIT_REACHED]
          );
          continue;
        }
      }
      await client.query("UPDATE message_queue SET status = 'processing', updated_at = now() WHERE id = $1", [item.id]);
      ready.push(item);
    }
    return ready;
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const item of items) {
    const current = await reminderStillCurrent(item);
    if (!current.ok) {
      await skipStaleReminder(item, current.reason);
      skipped++;
      continue;
    }
    if (item.channel_type === "whatsapp") {
      if (await pauseRiskyChannel(item)) {
        skipped++;
        break;
      }
      const safety = await transaction((client) => whatsappSafety(client, item));
      if (!safety.ok) {
        const retryAt = safety.retryAt || nextSendingWindow(new Date(Date.now() + 15 * 60_000));
        await query(
          `UPDATE message_queue SET status = 'pending', safety_status = 'blocked', safety_reason = $2,
                  last_error = $2, scheduled_for = $3, updated_at = now() WHERE id = $1`,
          [item.id, safety.reason, retryAt]
        );
        skipped++;
        continue;
      }
    }

    try {
      let provider;
      if (item.channel_type === "whatsapp") {
        provider = await evolutionSendText(item.instance_name, item.destination, item.message_body);
      } else if (item.channel_type === "email") {
        provider = await sendQueuedEmail({
          to: item.email_to,
          subject: item.subject,
          text: item.message_body,
          templateSnapshot: item.template_snapshot
        });
      } else {
        throw new Error("SMS provider is not configured");
      }
      const providerMessageId = provider?.key?.id || provider?.id || null;
      await markSent(item, providerMessageId);
      sent++;
    } catch (error) {
      const finalStatus = await markFailed(item, error);
      if (finalStatus === "failed") await enqueueFallback(item);
      failed++;
    }
  }
  return { processed: items.length, sent, failed, skipped };
}

export async function runWhatsAppHealthCheck() {
  const channels = await query(
    `SELECT wc.id, wc.tenant_id, wc.instance_name, wc.status, wc.failure_rate,
            wc.hourly_sent, wc.risk_score,
            COALESCE(ws.hourly_message_limit, 20) AS hourly_limit,
            (SELECT count(*) FROM unsubscribe_list ul WHERE ul.tenant_id = wc.tenant_id) AS unsubscribe_count
       FROM whatsapp_channels wc
       LEFT JOIN whatsapp_safety_settings ws ON ws.tenant_id = wc.tenant_id
      ORDER BY wc.created_at`
  );
  let connected = 0;
  let disconnected = 0;
  for (const channel of channels.rows) {
    const startedAt = Date.now();
    try {
      const response = await evolutionConnectionState(channel.instance_name);
      const state = response?.instance?.state || response?.state || "disconnected";
      const status = state === "open" || state === "connected" ? "connected" : "disconnected";
      const score = whatsappHealthScore({
        failureRate: Number(channel.failure_rate || 0),
        unsubscribeCount: Number(channel.unsubscribe_count || 0),
        disconnected: status !== "connected",
        hourlySent: Number(channel.hourly_sent || 0),
        hourlyLimit: Number(channel.hourly_limit || 20)
      });
      await transaction(async (client) => {
        await client.query(
          `UPDATE whatsapp_channels SET status = $2, connection_state = $3, health_score = $4,
                  risk_score = GREATEST(risk_score, $5), last_health_check_at = now(), last_error = NULL,
                  last_disconnect_at = CASE WHEN $2 = 'disconnected' THEN now() ELSE last_disconnect_at END,
                  updated_at = now() WHERE id = $1`,
          [channel.id, status, state, 100 - score.risk, score.risk]
        );
        await client.query(
          `INSERT INTO whatsapp_health_checks
             (tenant_id, whatsapp_channel_id, connection_state, health_score, risk_score, latency_ms)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [channel.tenant_id, channel.id, state, 100 - score.risk, score.risk, Date.now() - startedAt]
        );
      });
      status === "connected" ? connected++ : disconnected++;
    } catch (error) {
      const message = safeErrorMessage(error);
      await transaction(async (client) => {
        await client.query(
          `UPDATE whatsapp_channels SET status = 'error', connection_state = 'error', health_score = 0,
                  last_health_check_at = now(), last_error = $2, updated_at = now() WHERE id = $1`,
          [channel.id, message]
        );
        await client.query(
          `INSERT INTO whatsapp_health_checks
             (tenant_id, whatsapp_channel_id, connection_state, health_score, risk_score, latency_ms, error_message)
           VALUES ($1,$2,'error',0,$3,$4,$5)`,
          [channel.tenant_id, channel.id, Number(channel.risk_score || 0), Date.now() - startedAt, message]
        );
      });
      disconnected++;
    }
  }
  return { checked: channels.rowCount, connected, disconnected };
}

export async function runUsageReset() {
  const tenants = await query("SELECT id FROM tenants WHERE status <> 'disabled' ORDER BY created_at");
  let ensured = 0;
  for (const tenant of tenants.rows) {
    await getCurrentMessageUsage(tenant.id);
    ensured++;
  }
  await query("UPDATE whatsapp_channels SET daily_sent = 0, hourly_sent = 0 WHERE daily_sent <> 0 OR hourly_sent <> 0");
  return { ensured };
}

export async function runCleanup() {
  const sessions = await query("DELETE FROM sessions WHERE expires_at < now() RETURNING id");
  const resets = await query("DELETE FROM password_reset_codes WHERE created_at < now() - interval '30 days' RETURNING id");
  const queue = await query("DELETE FROM message_queue WHERE status = 'sent' AND updated_at < now() - interval '30 days' RETURNING id");
  await query("UPDATE whatsapp_channels SET qr_code_cache = NULL WHERE status NOT IN ('pending_qr', 'connecting') AND qr_code_cache IS NOT NULL");
  return { expiredSessions: sessions.rowCount, expiredResetCodes: resets.rowCount, oldQueueItems: queue.rowCount };
}

export async function runCronJob(jobName) {
  const runners = {
    "renewal-reminders": runRenewalReminders,
    "message-retry": runMessageRetry,
    "message-worker": runMessageRetry,
    "whatsapp-health-check": runWhatsAppHealthCheck,
    "usage-reset": runUsageReset,
    cleanup: runCleanup
  };
  const runner = runners[jobName];
  if (!runner) throw new Error(`Unknown cron job: ${jobName}`);
  const result = await runner();
  await query(
    `INSERT INTO activity_logs (tenant_id, type, title, metadata)
     SELECT id, 'cron.executed', $1, $2::jsonb FROM tenants`,
    [`Cron ${jobName} executed`, JSON.stringify(result)]
  );
  return result;
}
