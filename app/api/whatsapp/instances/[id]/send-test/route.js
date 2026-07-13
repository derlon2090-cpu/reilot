import { normalizeEvolutionPhone } from "../../../../../../src/lib/evolution.js";
import { evaluateMessageQuality } from "../../../../../../src/lib/messageSafety.js";
import { evolutionSendText, isEvolutionTimeout } from "../../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";
import { addWhatsAppActivity, ownedChannel } from "../../../../../../src/server/whatsapp-repository.js";
import { query, transaction } from "../../../../../../src/server/db.js";
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

  let notificationLogId;
  try {
    const processingLog = await query(
      `INSERT INTO notification_logs (tenant_id, whatsapp_channel_id, channel, to_number, message_type, message_body, status)
       VALUES ($1, $2, 'whatsapp', $3, 'test', $4, 'sending') RETURNING id`,
      [auth.session.tenantId, id, normalized.phoneNumber, message]
    );
    notificationLogId = processingLog.rows[0]?.id;
  } catch (error) {
    console.error("unable to create WhatsApp sending log", safeErrorMessage(error));
    return Response.json({ ok: false, code: "SEND_LOG_FAILED", message: "تعذر بدء إرسال رسالة الاختبار بأمان. حاول مرة أخرى." }, { status: 503 });
  }

  let sent;
  try {
    sent = await evolutionSendText(channel.instanceName, normalized.phoneNumber, message);
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    const timeout = isEvolutionTimeout(error);
    console.error("evolution test message failed", errorMessage);
    if (timeout) {
      await query("UPDATE notification_logs SET error_message = $2 WHERE id = $1", [notificationLogId, "Provider response timed out; delivery verification is pending"]).catch(() => null);
      await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "whatsapp_send", source: "send_test", sourceId: id, severity: "warning", message: errorMessage, suggestedSolution: "Verify delivery status before retrying to avoid a duplicate message.", metadata: { notificationLogId, status: "pending_verification" } }).catch(() => null);
      return Response.json({ ok: true, type: "pending", status: "pending_verification", message: "تم إرسال الطلب إلى واتساب، جارٍ التحقق من حالة الإرسال." }, { status: 202 });
    }
    await query("UPDATE notification_logs SET status = 'failed', error_message = $2 WHERE id = $1", [notificationLogId, errorMessage]).catch(() => null);
    await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "whatsapp_send", source: "send_test", sourceId: id, message: errorMessage, suggestedSolution: "Verify the WhatsApp connection and recipient number, then retry.", metadata: { notificationLogId } }).catch(() => null);
    return Response.json({ ok: false, code: "WHATSAPP_SEND_FAILED", message: "تعذر إرسال رسالة الاختبار. تحقق من اتصال واتساب." }, { status: 502 });
  }

  const providerMessageId = sent?.key?.id || sent?.id || null;
  let auditPending = false;
  try {
    await transaction(async (client) => {
      await client.query(
        `UPDATE notification_logs SET provider_message_id = $2, status = 'sent', sent_at = now(), error_message = NULL WHERE id = $1`,
        [notificationLogId, providerMessageId]
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
  } catch (error) {
    auditPending = true;
    const errorMessage = safeErrorMessage(error);
    console.error("WhatsApp message sent but audit persistence failed", errorMessage);
    await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "whatsapp_send_audit", source: "send_test", sourceId: id, severity: "warning", message: errorMessage, suggestedSolution: "Reconcile the sent notification log without resending the message.", metadata: { notificationLogId, providerMessageIdPresent: Boolean(providerMessageId) } }).catch(() => null);
  }
  return Response.json({ ok: true, type: "sent", status: "sent", providerMessageId, auditPending, message: "تم إرسال رسالة الاختبار بنجاح." });
}
