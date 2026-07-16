import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT s.id, s.order_number AS "orderNumber", s.plan_name AS "planName",
            s.service_name AS "serviceName", s.start_date AS "startDate", s.end_date AS "endDate",
            s.status, c.id AS "customerId", c.name AS "customerName", c.email,
            COALESCE(c.whatsapp_number, c.phone) AS "phoneNumber"
       FROM subscriptions s
       JOIN customers c ON c.id = s.customer_id AND c.tenant_id = s.tenant_id
      WHERE s.tenant_id = $1 ORDER BY s.created_at DESC`,
    [auth.session.tenantId]
  );
  return Response.json({ ok: true, items: result.rows });
}
