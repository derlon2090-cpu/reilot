import { transaction } from "../../../../../src/server/db.js";
import { recordOperationalIssue } from "../../../../../src/server/operations.js";
import { requireSession } from "../../../../../src/server/session.js";

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await transaction(async (client) => {
    const selected = await client.query(
      `SELECT s.id, s.customer_id, c.phone, c.whatsapp_number, c.reminders_paused,
              wc.id AS channel_id, wc.status AS channel_status, wc.risk_score,
              EXISTS(SELECT 1 FROM unsubscribe_list ul WHERE ul.tenant_id = s.tenant_id AND ul.phone_number IN (c.phone, c.whatsapp_number)) AS unsubscribed,
              (SELECT id FROM notification_templates nt WHERE nt.tenant_id = s.tenant_id AND nt.channel = 'whatsapp' AND nt.is_active = true ORDER BY created_at LIMIT 1) AS template_id
         FROM subscriptions s JOIN customers c ON c.id = s.customer_id
         LEFT JOIN LATERAL (SELECT id, status, risk_score FROM whatsapp_channels WHERE tenant_id = s.tenant_id ORDER BY created_at DESC LIMIT 1) wc ON true
        WHERE s.id = $1 AND s.tenant_id = $2 FOR UPDATE OF s`,
      [id, auth.session.tenantId]
    );
    const item = selected.rows[0];
    if (!item) return { status: 404, reason: "subscription_not_found" };
    if (item.channel_status !== "connected") return { status: 409, reason: "whatsapp_not_connected" };
    if (Number(item.risk_score || 0) > 70) return { status: 423, reason: "high_risk_score" };
    if (item.reminders_paused) return { status: 409, reason: "reminders_paused" };
    if (item.unsubscribed) return { status: 409, reason: "unsubscribed" };
    const triggerKey = `manual:${id}:${new Date().toISOString().slice(0, 10)}`;
    const queued = await client.query(
      `INSERT INTO message_queue (tenant_id, subscription_id, customer_id, whatsapp_channel_id, template_id, scheduled_for, status, trigger_key)
       SELECT $1, $2, $3, $4, $5, now(), 'pending', $6
        WHERE NOT EXISTS (SELECT 1 FROM message_queue WHERE tenant_id = $1 AND trigger_key = $6)
       RETURNING id`,
      [auth.session.tenantId, id, item.customer_id, item.channel_id, item.template_id, triggerKey]
    );
    if (!queued.rows[0]) return { status: 409, reason: "duplicate_trigger" };
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, customer_id, type, title, metadata)
       VALUES ($1, $2, $3, 'subscription.reminder_queued', 'Renewal reminder queued', $4::jsonb)`,
      [auth.session.tenantId, auth.session.userId, item.customer_id, JSON.stringify({ subscriptionId: id, queueId: queued.rows[0].id })]
    );
    return { status: 201, queueId: queued.rows[0].id };
  });
  if (result.status !== 201) {
    if (["high_risk_score", "reminders_paused", "unsubscribed", "duplicate_trigger", "whatsapp_not_connected"].includes(result.reason)) {
      await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "safe_mode", source: "manual_reminder", sourceId: id, severity: result.reason === "high_risk_score" ? "critical" : "warning", message: result.reason, suggestedSolution: result.reason === "whatsapp_not_connected" ? "Connect WhatsApp before sending reminders." : "Review customer messaging permissions and WhatsApp safety limits." }).catch(() => null);
    }
    return Response.json({ ok: false, reason: result.reason }, { status: result.status });
  }
  return Response.json({ ok: true, queueId: result.queueId }, { status: 201 });
}
