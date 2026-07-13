import { transaction, query } from "../../../src/server/db.js";
import { normalizeEvolutionPhone } from "../../../src/lib/evolution.js";
import { requireSession } from "../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT c.id, c.name, c.email, c.phone, c.whatsapp_number AS "whatsappNumber", c.status,
            c.tags, c.reminders_paused AS "remindersPaused", c.created_at AS "createdAt",
            COALESCE(summary."subscriptionCount", 0)::int AS "subscriptionCount",
            COALESCE(summary."totalValue", 0)::numeric AS "totalValue",
            summary."serviceName", summary."lastRenewal"
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT count(*) AS "subscriptionCount", COALESCE(sum(price), 0) AS "totalValue",
                max(service_name) AS "serviceName", max(end_date) AS "lastRenewal"
           FROM subscriptions WHERE tenant_id = c.tenant_id AND customer_id = c.id
       ) summary ON true
      WHERE c.tenant_id = $1 ORDER BY c.created_at DESC`,
    [auth.session.tenantId]
  );
  return Response.json({ ok: true, items: result.rows });
}

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (name.length < 2) return Response.json({ ok: false, reason: "invalid_name" }, { status: 400 });
  let phone = null;
  if (body.phone) {
    const normalized = normalizeEvolutionPhone(body.phone);
    if (!normalized.ok) return Response.json({ ok: false, reason: "invalid_phone" }, { status: 400 });
    phone = normalized.phoneNumber;
  }
  const item = await transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO customers (tenant_id, name, email, phone, whatsapp_number, status, tags)
       VALUES ($1, $2, $3, $4, $4, $5, $6::jsonb)
       RETURNING id, name, email, phone, whatsapp_number AS "whatsappNumber", status, tags, created_at AS "createdAt"`,
      [auth.session.tenantId, name, body.email || null, phone, body.status === "inactive" ? "inactive" : "active", JSON.stringify(body.tags || [])]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, customer_id, type, title)
       VALUES ($1, $2, $3, 'customer.created', 'Customer created')`,
      [auth.session.tenantId, auth.session.userId, inserted.rows[0].id]
    );
    return inserted.rows[0];
  });
  return Response.json({ ok: true, item }, { status: 201 });
}
