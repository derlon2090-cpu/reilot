import crypto from "node:crypto";
import { query, transaction } from "../../../src/server/db.js";
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

const allowedStatuses = new Set(["active", "expiring_soon", "expired", "renewed", "paused", "cancelled"]);

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  if (!body.customerId || !body.serviceName || !body.planName || !body.startDate || !body.endDate) {
    return Response.json({ ok: false, reason: "missing_fields" }, { status: 400 });
  }
  if (new Date(body.endDate) < new Date(body.startDate)) {
    return Response.json({ ok: false, reason: "invalid_dates" }, { status: 400 });
  }
  const item = await transaction(async (client) => {
    const customer = await client.query("SELECT id FROM customers WHERE id = $1 AND tenant_id = $2", [body.customerId, auth.session.tenantId]);
    if (!customer.rows[0]) return null;
    const orderNumber = String(body.orderNumber || `RP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`).trim();
    const inserted = await client.query(
      `INSERT INTO subscriptions (
         tenant_id, customer_id, order_number, service_name, plan_name, start_date, end_date,
         renewal_url, status, auto_renew, price, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, order_number AS "orderNumber"`,
      [auth.session.tenantId, body.customerId, orderNumber, body.serviceName, body.planName, body.startDate, body.endDate,
        body.renewalUrl || null, allowedStatuses.has(body.status) ? body.status : "active", Boolean(body.autoRenew), Number(body.price || 0), body.notes || null]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, customer_id, type, title, metadata)
       VALUES ($1, $2, $3, 'subscription.created', 'Subscription created', $4::jsonb)`,
      [auth.session.tenantId, auth.session.userId, body.customerId, JSON.stringify({ subscriptionId: inserted.rows[0].id, orderNumber })]
    );
    return inserted.rows[0];
  });
  return item ? Response.json({ ok: true, item }, { status: 201 }) : Response.json({ ok: false, reason: "customer_not_found" }, { status: 404 });
}
