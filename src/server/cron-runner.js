import { canSendSafely, warmupDailyLimit } from "../lib/messageSafety.js";
import { query, transaction } from "./db.js";
import { evolutionConnectionState, evolutionSendText } from "./evolution-client.js";
import { safeErrorMessage } from "./security.js";

export async function runRenewalReminders() {
  const result = await query(
    `INSERT INTO message_queue (tenant_id, subscription_id, customer_id, whatsapp_channel_id, template_id, scheduled_for, status, trigger_key)
     SELECT s.tenant_id, s.id, s.customer_id, wc.id, ar.template_id, now(), 'pending',
            s.tenant_id::text || ':' || s.id::text || ':renewal:' || ar.days_offset::text
       FROM subscriptions s
       JOIN automation_rules ar ON ar.tenant_id = s.tenant_id AND ar.is_active = true
       JOIN customers c ON c.id = s.customer_id
       JOIN LATERAL (SELECT id FROM whatsapp_channels WHERE tenant_id = s.tenant_id AND status = 'connected' ORDER BY created_at DESC LIMIT 1) wc ON true
      WHERE s.status IN ('active', 'expiring_soon', 'expired')
        AND (s.end_date - current_date) = ar.days_offset
        AND NOT EXISTS (SELECT 1 FROM unsubscribe_list ul WHERE ul.tenant_id = s.tenant_id AND ul.phone_number IN (c.whatsapp_number, c.phone))
        AND NOT EXISTS (SELECT 1 FROM message_queue mq WHERE mq.trigger_key = s.tenant_id::text || ':' || s.id::text || ':renewal:' || ar.days_offset::text)
     RETURNING id`
  );
  return { queued: result.rowCount };
}
async function queueItemSafety(client, item) {
  const settingsResult = await client.query(
    `SELECT ws.*, wc.status AS channel_status, wc.daily_sent, wc.hourly_sent, wc.failure_rate, wc.risk_score, wc.warmup_day,
            EXISTS(SELECT 1 FROM unsubscribe_list ul WHERE ul.tenant_id = $1 AND ul.phone_number IN ($2, $3)) AS unsubscribed,
            EXISTS(SELECT 1 FROM notification_logs nl WHERE nl.tenant_id = $1 AND nl.to_number IN ($2, $3) AND nl.message_body = $4 AND nl.created_at > now() - (ws.duplicate_message_window_hours || ' hours')::interval) AS duplicate
       FROM whatsapp_safety_settings ws JOIN whatsapp_channels wc ON wc.id = $5
      WHERE ws.tenant_id = $1`,
    [item.tenant_id, item.whatsapp_number, item.phone, item.message_body, item.whatsapp_channel_id]
  );
  const safety = settingsResult.rows[0];
  if (!safety) return { ok: false, reason: "missing_safety_settings" };
  return canSendSafely({
    safeModeEnabled: safety.safe_mode_enabled,
    hourlySent: safety.hourly_sent,
    dailySent: safety.daily_sent,
    hourlyLimit: Math.min(safety.hourly_message_limit, warmupDailyLimit(safety.warmup_day)),
    dailyLimit: Math.min(safety.daily_message_limit, warmupDailyLimit(safety.warmup_day)),
    quietHoursStart: String(safety.quiet_hours_start).slice(0, 5),
    quietHoursEnd: String(safety.quiet_hours_end).slice(0, 5),
    unsubscribed: safety.unsubscribed,
    duplicateWithinWindow: safety.duplicate,
    failRatePercent: Number(safety.failure_rate),
    maxFailRatePercent: safety.max_fail_rate_percent,
    riskScore: safety.risk_score,
    maxBlockRiskScore: safety.max_block_risk_score,
    channelStatus: safety.channel_status
  });
}

export async function runMessageRetry() {
  const items = await transaction(async (client) => {
    const locked = await client.query(
      `SELECT mq.*, c.whatsapp_number, c.phone, wc.channel_id,
              COALESCE(nt.body, 'مرحبًا {{customer_name}}، حان موعد تجديد اشتراكك. أرسل إيقاف لإلغاء الرسائل.') AS message_body,
              c.name AS customer_name
         FROM message_queue mq
         JOIN customers c ON c.id = mq.customer_id
         JOIN whatsapp_channels wc ON wc.id = mq.whatsapp_channel_id
         LEFT JOIN notification_templates nt ON nt.id = mq.template_id
        WHERE mq.status = 'pending' AND mq.scheduled_for <= now()
        ORDER BY mq.priority, mq.scheduled_for
        FOR UPDATE OF mq SKIP LOCKED LIMIT 20`
    );
    for (const item of locked.rows) await client.query("UPDATE message_queue SET status = 'processing', updated_at = now() WHERE id = $1", [item.id]);
    return locked.rows;
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const item of items) {
    const safety = await transaction((client) => queueItemSafety(client, item));
    if (!safety.ok) {
      await query("UPDATE message_queue SET status = 'pending', last_error = $2, scheduled_for = now() + interval '15 minutes', updated_at = now() WHERE id = $1", [item.id, safety.reason]);
      skipped += 1;
      continue;
    }
    const to = item.whatsapp_number || item.phone;
    const message = item.message_body.replace(/{{customer_name}}|{{name}}/g, item.customer_name);
    try {
      const provider = await evolutionSendText(item.channel_id, to, message);
      await transaction(async (client) => {
        await client.query("UPDATE message_queue SET status = 'sent', attempts = attempts + 1, updated_at = now() WHERE id = $1", [item.id]);
        await client.query(
          `INSERT INTO notification_logs (tenant_id, customer_id, subscription_id, whatsapp_channel_id, channel, to_number, message_type, message_body, provider_message_id, status, sent_at)
           VALUES ($1, $2, $3, $4, 'whatsapp', $5, 'renewal', $6, $7, 'sent', now())`,
          [item.tenant_id, item.customer_id, item.subscription_id, item.whatsapp_channel_id, to, message, provider?.key?.id || provider?.id || null]
        );
        await client.query("UPDATE whatsapp_channels SET daily_sent = daily_sent + 1, hourly_sent = hourly_sent + 1, updated_at = now() WHERE id = $1", [item.whatsapp_channel_id]);
      });
      sent += 1;
    } catch (error) {
      const lastError = safeErrorMessage(error);
      const nextStatus = item.attempts + 1 >= item.max_attempts ? "failed" : "pending";
      await query(
        `UPDATE message_queue SET status = $2, attempts = attempts + 1, last_error = $3,
                scheduled_for = now() + (power(2, attempts + 1)::text || ' minutes')::interval, updated_at = now()
          WHERE id = $1`,
        [item.id, nextStatus, lastError]
      );
      failed += 1;
    }
  }
  return { processed: items.length, sent, failed, skipped };
}

export async function runWhatsAppHealthCheck() {
  const channels = await query("SELECT id, tenant_id, channel_id, status FROM whatsapp_channels ORDER BY created_at");
  let connected = 0;
  let disconnected = 0;
  for (const channel of channels.rows) {
    try {
      const response = await evolutionConnectionState(channel.channel_id);
      const state = response?.instance?.state || response?.state || "disconnected";
      const status = state === "open" || state === "connected" ? "connected" : "disconnected";
      await query(
        `UPDATE whatsapp_channels SET status = $2, last_health_check_at = now(), last_error = NULL,
                last_disconnect_at = CASE WHEN $2 = 'disconnected' THEN now() ELSE last_disconnect_at END, updated_at = now()
          WHERE id = $1`,
        [channel.id, status]
      );
      status === "connected" ? connected++ : disconnected++;
    } catch (error) {
      await query("UPDATE whatsapp_channels SET status = 'error', last_health_check_at = now(), last_error = $2, updated_at = now() WHERE id = $1", [channel.id, safeErrorMessage(error)]);
      disconnected += 1;
    }
  }
  return { checked: channels.rowCount, connected, disconnected };
}

export async function runUsageReset() {
  const result = await query(
    `INSERT INTO message_usage (tenant_id, month, year, used_messages, message_limit)
     SELECT t.id, extract(month from current_date)::int, extract(year from current_date)::int, 0, COALESCE(pp.message_limit, 50)
       FROM tenants t
       LEFT JOIN platform_subscriptions ps ON ps.tenant_id = t.id AND ps.status IN ('trial', 'active')
       LEFT JOIN platform_plans pp ON pp.id = ps.plan_id
     ON CONFLICT (tenant_id, month, year) DO NOTHING RETURNING id`
  );
  await query("UPDATE whatsapp_channels SET daily_sent = 0, hourly_sent = 0 WHERE daily_sent <> 0 OR hourly_sent <> 0");
  return { created: result.rowCount };
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
