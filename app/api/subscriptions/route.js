import { query } from "../../../src/server/db.js";
import { requireSession } from "../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT s.id, s.order_number AS "orderNumber", s.service_name AS "serviceName", s.plan_name AS "planName",
            s.start_date AS "startDate", s.end_date AS "endDate", s.renewal_url AS "renewalUrl", s.status, s.price,
            c.id AS "customerId", c.name AS "customerName", c.phone, c.whatsapp_number AS "whatsappNumber",
            c.reminders_paused AS "remindersPaused",
            COALESCE(wc.status, 'not_connected') AS "whatsappStatus", COALESCE(wc.risk_score, 0) AS "riskScore",
            (COALESCE(wc.status, 'not_connected') = 'connected' AND COALESCE(wc.risk_score, 0) <= 70 AND c.reminders_paused = false) AS "canSend"
       FROM subscriptions s
       JOIN customers c ON c.id = s.customer_id AND c.tenant_id = s.tenant_id
       LEFT JOIN LATERAL (
         SELECT status, risk_score FROM whatsapp_channels
          WHERE tenant_id = s.tenant_id ORDER BY created_at DESC LIMIT 1
       ) wc ON true
      WHERE s.tenant_id = $1 ORDER BY s.end_date, s.created_at DESC`,
    [auth.session.tenantId]
  );
  return Response.json({ ok: true, items: result.rows });
}
