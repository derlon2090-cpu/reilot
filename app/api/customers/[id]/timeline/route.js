import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";

export async function GET(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const owned = await query("SELECT id, created_at FROM customers WHERE id = $1 AND tenant_id = $2", [id, auth.session.tenantId]);
  if (!owned.rows[0]) return Response.json({ ok: false }, { status: 404 });
  const result = await query(
    `SELECT type, title, metadata, created_at AS "createdAt" FROM activity_logs
      WHERE tenant_id = $1 AND customer_id = $2
     UNION ALL
     SELECT 'notification.' || status, 'WhatsApp notification ' || status,
            jsonb_build_object('channel', channel, 'error', error_message), created_at
       FROM notification_logs WHERE tenant_id = $1 AND customer_id = $2
     UNION ALL
     SELECT 'subscription.created', 'Subscription added', jsonb_build_object('subscriptionId', id, 'plan', plan_name), created_at
       FROM subscriptions WHERE tenant_id = $1 AND customer_id = $2
     ORDER BY "createdAt" DESC LIMIT 200`,
    [auth.session.tenantId, id]
  );
  return Response.json({ ok: true, items: [{ type: "customer.created", title: "Customer created", metadata: {}, createdAt: owned.rows[0].created_at }, ...result.rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
}
