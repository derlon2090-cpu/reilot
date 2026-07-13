import { normalizeEvolutionPhone } from "../../../../../../src/lib/evolution.js";
import { evaluateMessageQuality } from "../../../../../../src/lib/messageSafety.js";
import { evolutionSendText } from "../../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";
import { addWhatsAppActivity, ownedChannel } from "../../../../../../src/server/whatsapp-repository.js";
import { transaction } from "../../../../../../src/server/db.js";
import { recordOperationalIssue, resolveOperationalIssues } from "../../../../../../src/server/operations.js";

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const normalized = normalizeEvolutionPhone(body.to);
  if (!normalized.ok) return Response.json({ ok: false, message: "Invalid WhatsApp number" }, { status: 400 });
  const message = String(body.message || "").trim();
  if (!message || message.length > 1000) return Response.json({ ok: false, message: "Invalid message" }, { status: 400 });
  const quality = evaluateMessageQuality(message);
  if (quality.score === "risk") return Response.json({ ok: false, message: "Message blocked by the safety checker", quality }, { status: 422 });
  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel || channel.status !== "connected") return Response.json({ ok: false, message: "WhatsApp is not connected" }, { status: 409 });
  if (Number(channel.riskScore || 0) > 70) {
    await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "safe_mode", source: "send_test", sourceId: id, severity: "critical", message: "WhatsApp risk score is above 70", suggestedSolution: "Review recent failures and reduce sending volume before resuming." });
    return Response.json({ ok: false, message: "Sending is blocked because the WhatsApp risk score is above 70" }, { status: 423 });
  }
  try {
    const sent = await evolutionSendText(channel.instanceName, normalized.phoneNumber, message);
    const providerMessageId = sent?.key?.id || sent?.id || null;
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO notification_logs (tenant_id, whatsapp_channel_id, channel, to_number, message_type, message_body, provider_message_id, status, sent_at)
         VALUES ($1, $2, 'whatsapp', $3, 'test', $4, $5, 'sent', now())`,
        [auth.session.tenantId, id, normalized.phoneNumber, message, providerMessageId]
      );
      await client.query(
        `INSERT INTO message_usage (tenant_id, month, year, used_messages, message_limit)
         VALUES ($1, extract(month from current_date)::int, extract(year from current_date)::int, 1, 0)
         ON CONFLICT (tenant_id, month, year) DO UPDATE SET used_messages = message_usage.used_messages + 1, updated_at = now()`,
        [auth.session.tenantId]
      );
    });
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "send_test_message", title: "WhatsApp test message sent", metadata: { providerMessageId: sent?.key?.id || sent?.id || null } });
    await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "whatsapp_send", sourceId: id });
    return Response.json({ ok: true, providerMessageId });
  } catch (error) {
    console.error("evolution test message failed", safeErrorMessage(error));
    await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "whatsapp_send", source: "send_test", sourceId: id, message: safeErrorMessage(error), suggestedSolution: "Verify the WhatsApp connection and recipient number, then retry." }).catch(() => null);
    return Response.json({ ok: false, message: "Unable to send test message" }, { status: 502 });
  }
}
