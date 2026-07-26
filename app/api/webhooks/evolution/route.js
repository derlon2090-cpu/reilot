import crypto from "node:crypto";
import { query, transaction } from "../../../../src/server/db.js";
import { safeErrorMessage } from "../../../../src/server/security.js";
import { ensureDefaultTemplates, TEMPLATE_KEYS } from "../../../../src/server/default-templates.js";
import { evolutionSendList } from "../../../../src/server/evolution-client.js";
import { enqueueAdminDomainEvent } from "../../../../src/server/admin-template-events.js";

const DISCONNECT_REASON_LABELS = Object.freeze({
  authorization_revoked: "تم إلغاء صلاحية الربط من مزود الخدمة.",
  token_expired: "انتهت صلاحية التفويض ولم يتم تجديدها.",
  provider_rejected: "رفض مزود الخدمة استمرار الاتصال.",
  integration_deleted: "تم حذف التكامل المرتبط بالقناة.",
  policy_violation: "تم إيقاف القناة نتيجة مخالفة سياسة الاستخدام.",
  permanent_connection_failure: "تعذر استعادة الاتصال بعد المحاولات المسموحة."
});

function messageText(data) {
  return data?.message?.conversation
    || data?.message?.extendedTextMessage?.text
    || data?.message?.buttonsResponseMessage?.selectedDisplayText
    || data?.message?.listResponseMessage?.title
    || "";
}

function phoneFromJid(value) {
  return String(value || "").split("@")[0].replace(/\D/g, "");
}

function renderMenuText(value, variables) {
  return String(value || "").replace(/{{\s*(customer_name|store_name)\s*}}/g, (_match, key) => variables[key] || "");
}

function incomingMessages(body) {
  const value = body?.data;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.messages)) return value.messages;
  return value && typeof value === "object" ? [value] : [];
}

function evolutionDelivery(body) {
  const data = body?.data || {};
  const providerMessageId = data?.key?.id || data?.messageId || data?.id || body?.messageId || null;
  const raw = String(data?.status || data?.update?.status || data?.message?.status || body?.status || "").toLowerCase();
  const status = raw.includes("read") ? "read"
    : raw.includes("deliver") ? "delivered"
      : raw.includes("sent") || raw.includes("server.ack") || raw === "2" ? "sent"
        : raw.includes("fail") || raw.includes("error") ? "failed" : null;
  return { providerMessageId: providerMessageId ? String(providerMessageId) : null, raw, status };
}

function permanentDisconnection(body) {
  const data = body?.data || {};
  const value = String(
    data?.state || data?.status || data?.reason || data?.disconnectReason
    || body?.state || body?.reason || ""
  ).toLowerCase();
  if (/logged.?out|logout|authorization.?revoked|unauthori[sz]ed/.test(value)) {
    return { code: "authorization_revoked", label: DISCONNECT_REASON_LABELS.authorization_revoked };
  }
  if (/token.?expired/.test(value)) {
    return { code: "token_expired", label: DISCONNECT_REASON_LABELS.token_expired };
  }
  if (/banned|policy|forbidden/.test(value)) {
    return { code: "policy_violation", label: DISCONNECT_REASON_LABELS.policy_violation };
  }
  if (/instance.?deleted|integration.?deleted|removed/.test(value)) {
    return { code: "integration_deleted", label: DISCONNECT_REASON_LABELS.integration_deleted };
  }
  if (/rejected|permanent|bad.?session/.test(value)) {
    return { code: "provider_rejected", label: DISCONNECT_REASON_LABELS.provider_rejected };
  }
  return null;
}

async function recordAdminDelivery(body, event, instanceName) {
  const delivery = evolutionDelivery(body);
  if (!delivery.providerMessageId || !delivery.status) return false;
  const providerEventId = String(body?.id || body?.eventId || crypto.createHash("sha256")
    .update(`${instanceName}:${delivery.providerMessageId}:${event}:${delivery.raw}`)
    .digest("hex"));
  await transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO admin_message_provider_events
         (provider,provider_event_id,provider_message_id,event_type,payload)
       VALUES ('evolution',$1,$2,$3,$4::jsonb)
       ON CONFLICT (provider,provider_event_id) DO NOTHING RETURNING id`,
      [providerEventId, delivery.providerMessageId, event, JSON.stringify(body)]
    );
    if (!inserted.rows[0]) return;
    await client.query(
      `UPDATE admin_outbound_messages SET
              status=CASE
                WHEN status='read' THEN status
                WHEN status='delivered' AND $2 IN ('sent','accepted') THEN status
                WHEN status='sent' AND $2='accepted' THEN status
                ELSE $2
              END,
              sent_at=CASE WHEN $2='sent' THEN COALESCE(sent_at,now()) ELSE sent_at END,
              delivered_at=CASE WHEN $2='delivered' THEN COALESCE(delivered_at,now()) ELSE delivered_at END,
              read_at=CASE WHEN $2='read' THEN COALESCE(read_at,now()) ELSE read_at END,
              failed_at=CASE WHEN $2='failed' THEN COALESCE(failed_at,now()) ELSE failed_at END,
              failure_code=CASE WHEN $2='failed' THEN 'EVOLUTION_DELIVERY_FAILED' ELSE NULL END
        WHERE provider='evolution' AND provider_message_id=$1`,
      [delivery.providerMessageId, delivery.status]
    );
    await client.query(
      `UPDATE whatsapp_usage_records SET
              status=CASE
                WHEN status='read' THEN status
                WHEN status='delivered' AND $2 IN ('sent','accepted') THEN status
                WHEN status='sent' AND $2='accepted' THEN status
                ELSE $2
              END,
              delivered_at=CASE WHEN $2='delivered' THEN COALESCE(delivered_at,now()) ELSE delivered_at END,
              read_at=CASE WHEN $2='read' THEN COALESCE(read_at,now()) ELSE read_at END,
              failed_at=CASE WHEN $2='failed' THEN COALESCE(failed_at,now()) ELSE failed_at END,
              updated_at=now()
        WHERE meta_message_id=$1`,
      [delivery.providerMessageId, delivery.status]
    );
    await client.query("UPDATE admin_message_provider_events SET processed_at=now() WHERE id=$1", [inserted.rows[0].id]);
  });
  return true;
}

export async function POST(req) {
  const url = new URL(req.url);
  const expected = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!expected || url.searchParams.get("secret") !== expected) return Response.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const event = String(body.event || body.type || "").toLowerCase().replaceAll("_", ".");
  const instanceName = body.instance || body.instanceName || body.data?.instance || body.data?.instanceName;
  if (!instanceName) return Response.json({ ok: true, ignored: true });

  try {
    await recordAdminDelivery(body, event, instanceName);
    const channelResult = await query("SELECT id, tenant_id, status FROM whatsapp_channels WHERE instance_name = $1 LIMIT 1", [instanceName]);
    const channel = channelResult.rows[0];
    if (!channel) return Response.json({ ok: true, ignored: true });

    if (event.includes("connection")) {
      const providerState = body.data?.state || body.data?.status || body.state || "disconnected";
      const status = ["open", "connected"].includes(providerState) ? "connected" : providerState === "connecting" ? "connecting" : "disconnected";
      const phone = phoneFromJid(body.data?.instance?.ownerJid || body.data?.instance?.owner || body.data?.ownerJid || body.data?.owner);
      const deviceName = body.data?.instance?.profileName || body.data?.instance?.name || null;
      const permanent = status === "disconnected" ? permanentDisconnection(body) : null;
      await transaction(async (client) => {
        const changed = await client.query(
          `UPDATE whatsapp_channels SET status = $2, last_health_check_at = now(), updated_at = now(),
                  phone_number = COALESCE(NULLIF($3, ''), phone_number), device_name = COALESCE($4, device_name),
                  connected_at = CASE WHEN $2 = 'connected' THEN COALESCE(connected_at, now()) ELSE connected_at END,
                  disconnected_at = CASE WHEN $5 THEN now() ELSE disconnected_at END,
                  last_disconnect_at = CASE WHEN $5 THEN now() ELSE last_disconnect_at END,
                  last_error = CASE WHEN $5 THEN $6 ELSE last_error END
            WHERE id = $1
            RETURNING id`,
          [channel.id, status, phone, deviceName, Boolean(permanent), permanent?.label || null]
        );
        if (permanent && changed.rows[0]) {
          const disconnectionEventId = String(
            body?.id || body?.eventId || crypto.createHash("sha256")
              .update(`${instanceName}:${event}:${permanent.code}:${JSON.stringify(body?.data || {})}`)
              .digest("hex")
          );
          await enqueueAdminDomainEvent(client, {
            eventType: "channel.disconnected",
            aggregateType: "whatsapp_channel",
            aggregateId: channel.id,
            payloadRefs: {
              channelId: channel.id,
              disconnectionEventId,
              reasonCode: permanent.code
            },
            idempotencyKey: `admin-channel-disconnected:${disconnectionEventId}`
          });
        }
      });
      await query("INSERT INTO activity_logs (tenant_id, type, title, metadata) VALUES ($1, 'evolution.webhook.connection', $2, $3)", [channel.tenant_id, `WhatsApp ${status}`, JSON.stringify({ status })]);
    }

    if (event.includes("messages.upsert") || event.includes("message.upsert")) {
      for (const data of incomingMessages(body)) {
        const remoteJid = data?.key?.remoteJid || data?.remoteJid;
        const messageId = String(data?.key?.id || data?.id || "").trim();
        const phone = phoneFromJid(remoteJid);
        if (!phone || !messageId || data?.key?.fromMe === true || /@g\.us$|@broadcast$/i.test(String(remoteJid || ""))) continue;

        const received = await query(
          `INSERT INTO webhook_events (provider, external_event_id, tenant_id, event_type, payload, processing_status, attempts)
           VALUES ('evolution', $1, $2, 'messages.upsert', $3::jsonb, 'processing', 1)
           ON CONFLICT (provider, external_event_id) DO UPDATE SET
             processing_status='processing', attempts=webhook_events.attempts+1,
             error_message=NULL, updated_at=now()
           WHERE webhook_events.processing_status='failed'
           RETURNING id`,
          [`${instanceName}:${messageId}`, channel.tenant_id, JSON.stringify(data)]
        );
        const webhookEventId = received.rows[0]?.id;
        if (!webhookEventId) continue;

        const text = messageText(data).trim();
        if (/^(إيقاف|توقف|لا ترسل|stop|unsubscribe)$/i.test(text)) {
        await query(
          `INSERT INTO unsubscribe_list (tenant_id, phone_number, reason, source, keyword, unsubscribed_at)
           VALUES ($1, $2, 'User request', 'whatsapp', $3, now())
           ON CONFLICT (tenant_id, phone_number) DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source, keyword = EXCLUDED.keyword, unsubscribed_at = now()`,
            [channel.tenant_id, phone, text]
        );
        await query("INSERT INTO activity_logs (tenant_id, type, title, metadata) VALUES ($1, 'whatsapp.unsubscribed', 'WhatsApp opt-out received', $2)", [channel.tenant_id, JSON.stringify({ phone })]);
          await query("UPDATE webhook_events SET processing_status='completed',processed_at=now(),updated_at=now() WHERE id=$1", [webhookEventId]);
          continue;
        }

        try {
          const [menu, identity] = await Promise.all([
            transaction(async (client) => {
              await ensureDefaultTemplates(client, channel.tenant_id);
              const result = await client.query(
                `SELECT title, body, button_label AS "buttonLabel", footer_text AS "footerText", content_json AS "contentJson"
                   FROM notification_templates
                  WHERE tenant_id=$1 AND template_key=$2 AND is_active=true
                  LIMIT 1`,
                [channel.tenant_id, TEMPLATE_KEYS.WHATSAPP_MENU]
              );
              return result.rows[0] || null;
            }),
            query(
              `SELECT COALESCE((SELECT name FROM customers WHERE tenant_id=$1 AND regexp_replace(COALESCE(whatsapp_number,phone,''),'\\D','','g')=$2 ORDER BY updated_at DESC LIMIT 1),'عميلنا') AS "customerName",
                      COALESCE((SELECT name FROM stores WHERE tenant_id=$1 ORDER BY created_at LIMIT 1),(SELECT name FROM tenants WHERE id=$1),'Renvix') AS "storeName"`,
              [channel.tenant_id, phone]
            )
          ]);
          if (!menu) throw new Error("WhatsApp interactive message is unavailable");
          const variables = { customer_name: identity.rows[0]?.customerName || "عميلنا", store_name: identity.rows[0]?.storeName || "Renvix" };
          await evolutionSendList(instanceName, phone, {
            title: renderMenuText(menu.title || `مرحبًا ${variables.customer_name}`, variables),
            description: renderMenuText(menu.body, variables),
            buttonText: menu.buttonLabel || "عرض الخيارات",
            footerText: renderMenuText(menu.footerText || variables.store_name, variables),
            sections: menu.contentJson?.sections || []
          });
          await query("UPDATE webhook_events SET processing_status='completed',processed_at=now(),updated_at=now() WHERE id=$1", [webhookEventId]);
          await query("INSERT INTO activity_logs (tenant_id, type, title, metadata) VALUES ($1, 'whatsapp.menu.sent', 'WhatsApp interactive menu sent', $2)", [channel.tenant_id, JSON.stringify({ phone, messageId })]);
        } catch (menuError) {
          await query("UPDATE webhook_events SET processing_status='failed',error_message=$2,updated_at=now() WHERE id=$1", [webhookEventId, safeErrorMessage(menuError).slice(0, 500)]);
          throw menuError;
        }
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("evolution webhook failed", safeErrorMessage(error));
    return Response.json({ ok: false }, { status: 500 });
  }
}
