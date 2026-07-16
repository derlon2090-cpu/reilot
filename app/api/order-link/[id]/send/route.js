import { normalizeEvolutionPhone } from "../../../../../src/lib/evolution.js";
import { blockedReasonMessages, canSendSafely } from "../../../../../src/lib/messageSafety.js";
import { query, transaction } from "../../../../../src/server/db.js";
import { sendOrderInformationEmail } from "../../../../../src/server/email/resend.service.js";
import { evolutionSendText } from "../../../../../src/server/evolution-client.js";
import { recordOperationalIssue } from "../../../../../src/server/operations.js";
import { requireSession } from "../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../src/server/security.js";

function messageText({ customerName, storeName, publicUrl }) {
  return `مرحبًا ${customerName || "عميلنا"}،
يمكنك عرض معلومات طلبك ومدة اشتراكك من خلال الرابط التالي:
${publicUrl}

شكرًا لك،
${storeName}`;
}

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const method = ["copy", "whatsapp", "email"].includes(body.method) ? body.method : "copy";
  const record = await query(
    `SELECT l.id, l.public_url AS "publicUrl", l.order_number AS "orderNumber", l.status,
            l.customer_id AS "customerId", l.subscription_id AS "subscriptionId",
            c.name AS "customerName", c.email, COALESCE(c.whatsapp_number, c.phone) AS "phoneNumber",
            p.store_name AS "storeName"
       FROM order_info_links l
       JOIN order_link_profiles p ON p.tenant_id = l.tenant_id
       LEFT JOIN customers c ON c.id = l.customer_id AND c.tenant_id = l.tenant_id
      WHERE l.id = $1 AND l.tenant_id = $2 LIMIT 1`,
    [id, auth.session.tenantId]
  );
  const link = record.rows[0];
  if (!link) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (link.status !== "active") return Response.json({ ok: false, reason: "link_not_active" }, { status: 409 });

  if (method === "copy") {
    await query(
      "INSERT INTO order_link_events (tenant_id, order_info_link_id, event_type) VALUES ($1, $2, 'copied')",
      [auth.session.tenantId, id]
    );
    return Response.json({ ok: true, method, publicUrl: link.publicUrl });
  }

  if (method === "whatsapp") {
    const normalized = normalizeEvolutionPhone(link.phoneNumber);
    if (!normalized.ok) return Response.json({ ok: false, reason: "customer_phone_missing" }, { status: 400 });
    const text = messageText(link);
    const channelResult = await query(
      `SELECT wc.id, wc.instance_name AS "instanceName", wc.status AS "channelStatus",
              wc.daily_sent AS "dailySent", wc.hourly_sent AS "hourlySent",
              wc.failure_rate AS "failureRate", wc.risk_score AS "riskScore",
              COALESCE(ws.safe_mode_enabled, true) AS "safeModeEnabled",
              COALESCE(ws.daily_message_limit, 100) AS "dailyLimit",
              COALESCE(ws.hourly_message_limit, 20) AS "hourlyLimit",
              COALESCE(ws.quiet_hours_start, '21:00'::time) AS "quietHoursStart",
              COALESCE(ws.quiet_hours_end, '09:00'::time) AS "quietHoursEnd",
              COALESCE(ws.duplicate_message_window_hours, 24) AS "duplicateWindowHours",
              COALESCE(ws.max_fail_rate_percent, 20) AS "maxFailRatePercent",
              COALESCE(ws.max_block_risk_score, 70) AS "maxBlockRiskScore",
              EXISTS(
                SELECT 1 FROM unsubscribe_list ul
                 WHERE ul.tenant_id = wc.tenant_id
                   AND CASE
                     WHEN regexp_replace(ul.phone_number, '[^0-9]', '', 'g') ~ '^05[0-9]{8}$'
                       THEN '966' || substring(regexp_replace(ul.phone_number, '[^0-9]', '', 'g') FROM 2)
                     ELSE regexp_replace(ul.phone_number, '[^0-9]', '', 'g')
                   END = $2
              ) AS unsubscribed,
              EXISTS(
                SELECT 1 FROM notification_logs nl
                 WHERE nl.tenant_id = wc.tenant_id
                   AND regexp_replace(COALESCE(nl.to_number, ''), '[^0-9]', '', 'g') = $2
                   AND nl.message_body = $3
                   AND nl.created_at > now() - (COALESCE(ws.duplicate_message_window_hours, 24)::text || ' hours')::interval
              ) AS duplicate
         FROM whatsapp_channels wc
         LEFT JOIN whatsapp_safety_settings ws ON ws.tenant_id = wc.tenant_id
        WHERE wc.tenant_id = $1
        ORDER BY (wc.status = 'connected') DESC, wc.connected_at DESC NULLS LAST, wc.created_at DESC
        LIMIT 1`,
      [auth.session.tenantId, normalized.phoneNumber, text]
    );
    const channel = channelResult.rows[0];
    if (!channel) return Response.json({ ok: false, reason: "whatsapp_not_connected", message: "اربط جهازًا أولًا حتى تتمكن من إرسال الرابط عبر واتساب." }, { status: 409 });
    const safety = canSendSafely({
      safeModeEnabled: channel.safeModeEnabled,
      hourlySent: Number(channel.hourlySent || 0),
      dailySent: Number(channel.dailySent || 0),
      hourlyLimit: Number(channel.hourlyLimit || 20),
      dailyLimit: Number(channel.dailyLimit || 100),
      quietHoursStart: String(channel.quietHoursStart || "21:00").slice(0, 5),
      quietHoursEnd: String(channel.quietHoursEnd || "09:00").slice(0, 5),
      unsubscribed: Boolean(channel.unsubscribed),
      duplicateWithinWindow: Boolean(channel.duplicate),
      failRatePercent: Number(channel.failureRate || 0),
      maxFailRatePercent: Number(channel.maxFailRatePercent || 20),
      riskScore: Number(channel.riskScore || 0),
      maxBlockRiskScore: Number(channel.maxBlockRiskScore || 70),
      channelStatus: channel.channelStatus
    });
    if (!safety.ok) {
      await recordOperationalIssue({
        tenantId: auth.session.tenantId,
        category: "safe_mode",
        source: "order_link_send",
        sourceId: id,
        severity: safety.reason === "high_risk_score" ? "critical" : "warning",
        message: safety.reason,
        suggestedSolution: "Review WhatsApp connection, customer consent, quiet hours, duplicate protection, and sending limits.",
        metadata: { linkId: id, reason: safety.reason }
      }).catch(() => null);
      return Response.json({
        ok: false,
        reason: safety.reason,
        message: blockedReasonMessages.ar[safety.reason] || "تعذر إرسال الرابط بسبب قواعد الإرسال الآمن."
      }, { status: safety.reason === "high_risk_score" ? 423 : 409 });
    }
    let provider;
    try {
      provider = await evolutionSendText(channel.instanceName, normalized.phoneNumber, text);
    } catch (error) {
      return Response.json({ ok: false, reason: "whatsapp_send_failed", message: safeErrorMessage(error) }, { status: 502 });
    }
    const providerMessageId = provider?.key?.id || provider?.id || null;
    await transaction(async (client) => {
      await client.query(
        `UPDATE order_info_links SET send_method = 'whatsapp', sent_at = now(), updated_at = now()
          WHERE id = $1 AND tenant_id = $2`,
        [id, auth.session.tenantId]
      );
      await client.query(
        `INSERT INTO order_link_events (tenant_id, order_info_link_id, event_type)
         VALUES ($1, $2, 'sent_whatsapp')`,
        [auth.session.tenantId, id]
      );
      await client.query(
        `INSERT INTO notification_logs (
           tenant_id, customer_id, subscription_id, whatsapp_channel_id, channel,
           to_number, message_type, message_body, provider_message_id, status, sent_at
         ) VALUES ($1, $2, $3, $4, 'whatsapp', $5, 'order_info_link', $6, $7, 'sent', now())`,
        [auth.session.tenantId, link.customerId, link.subscriptionId, channel.id, normalized.phoneNumber, text, providerMessageId]
      );
      await client.query(
        `INSERT INTO message_usage (tenant_id, month, year, used_messages, message_limit)
         VALUES ($1, extract(month from current_date)::int, extract(year from current_date)::int, 1, 0)
         ON CONFLICT (tenant_id, month, year)
         DO UPDATE SET used_messages = message_usage.used_messages + 1, updated_at = now()`,
        [auth.session.tenantId]
      );
      await client.query(
        `UPDATE whatsapp_channels
            SET daily_sent = daily_sent + 1, hourly_sent = hourly_sent + 1, updated_at = now()
          WHERE id = $1 AND tenant_id = $2`,
        [channel.id, auth.session.tenantId]
      );
      await client.query(
        `INSERT INTO activity_logs (tenant_id, user_id, customer_id, type, title, metadata)
         VALUES ($1, $2, $3, 'order_link.sent_whatsapp', 'Order information link sent via WhatsApp', $4::jsonb)`,
        [auth.session.tenantId, auth.session.userId, link.customerId, JSON.stringify({ linkId: id, providerMessageId })]
      );
    });
    return Response.json({ ok: true, method, providerMessageId });
  }

  if (!link.email) return Response.json({ ok: false, reason: "customer_email_missing" }, { status: 400 });
  let provider;
  try {
    provider = await sendOrderInformationEmail({
      to: link.email,
      customerName: link.customerName,
      storeName: link.storeName,
      orderNumber: link.orderNumber,
      publicUrl: link.publicUrl
    });
  } catch (error) {
    return Response.json({ ok: false, reason: "email_not_configured", message: safeErrorMessage(error) }, { status: 503 });
  }
  const providerMessageId = provider?.id || null;
  await transaction(async (client) => {
    await client.query(
      `UPDATE order_info_links SET send_method = 'email', sent_at = now(), updated_at = now()
        WHERE id = $1 AND tenant_id = $2`,
      [id, auth.session.tenantId]
    );
    await client.query(
      "INSERT INTO order_link_events (tenant_id, order_info_link_id, event_type) VALUES ($1, $2, 'sent_email')",
      [auth.session.tenantId, id]
    );
    await client.query(
      `INSERT INTO email_logs (tenant_id, customer_id, to_email, subject, body, provider_message_id, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'sent', now())`,
      [auth.session.tenantId, link.customerId, link.email, `معلومات الطلب #${link.orderNumber}`, messageText(link), providerMessageId]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, customer_id, type, title, metadata)
       VALUES ($1, $2, $3, 'order_link.sent_email', 'Order information link sent via email', $4::jsonb)`,
      [auth.session.tenantId, auth.session.userId, link.customerId, JSON.stringify({ linkId: id, providerMessageId })]
    );
  });
  return Response.json({ ok: true, method, providerMessageId });
}
