import { query } from "../../../../src/server/db.js";
import { safeErrorMessage } from "../../../../src/server/security.js";

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

export async function POST(req) {
  const url = new URL(req.url);
  const expected = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!expected || url.searchParams.get("secret") !== expected) return Response.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const event = String(body.event || body.type || "").toLowerCase().replaceAll("_", ".");
  const instanceName = body.instance || body.instanceName || body.data?.instance || body.data?.instanceName;
  if (!instanceName) return Response.json({ ok: true, ignored: true });

  try {
    const channelResult = await query("SELECT id, tenant_id FROM whatsapp_channels WHERE channel_id = $1 LIMIT 1", [instanceName]);
    const channel = channelResult.rows[0];
    if (!channel) return Response.json({ ok: true, ignored: true });

    if (event.includes("connection")) {
      const providerState = body.data?.state || body.data?.status || body.state || "disconnected";
      const status = ["open", "connected"].includes(providerState) ? "connected" : providerState === "connecting" ? "connecting" : "disconnected";
      await query(
        `UPDATE whatsapp_channels SET status = $2, last_health_check_at = now(), updated_at = now(),
                connected_at = CASE WHEN $2 = 'connected' THEN COALESCE(connected_at, now()) ELSE connected_at END,
                disconnected_at = CASE WHEN $2 = 'disconnected' THEN now() ELSE disconnected_at END
          WHERE id = $1`,
        [channel.id, status]
      );
      await query("INSERT INTO activity_logs (tenant_id, type, title, metadata) VALUES ($1, 'evolution.webhook.connection', $2, $3)", [channel.tenant_id, `WhatsApp ${status}`, JSON.stringify({ status })]);
    }

    if (event.includes("messages") || event.includes("message")) {
      const data = body.data || {};
      const text = messageText(data);
      const phone = phoneFromJid(data?.key?.remoteJid || data?.remoteJid);
      if (phone && /^(إيقاف|توقف|لا ترسل|stop|unsubscribe)$/i.test(text.trim())) {
        await query(
          `INSERT INTO unsubscribe_list (tenant_id, phone_number, reason, source, keyword, unsubscribed_at)
           VALUES ($1, $2, 'User request', 'whatsapp', $3, now())
           ON CONFLICT (tenant_id, phone_number) DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source, keyword = EXCLUDED.keyword, unsubscribed_at = now()`,
          [channel.tenant_id, phone, text.trim()]
        );
        await query("INSERT INTO activity_logs (tenant_id, type, title, metadata) VALUES ($1, 'whatsapp.unsubscribed', 'WhatsApp opt-out received', $2)", [channel.tenant_id, JSON.stringify({ phone })]);
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("evolution webhook failed", safeErrorMessage(error));
    return Response.json({ ok: false }, { status: 500 });
  }
}
