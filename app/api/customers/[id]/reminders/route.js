import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const paused = body.paused !== false;
  const result = await query(
    "UPDATE customers SET reminders_paused = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3 RETURNING id, reminders_paused AS \"remindersPaused\"",
    [paused, id, auth.session.tenantId]
  );
  if (!result.rows[0]) return Response.json({ ok: false }, { status: 404 });
  await query(
    "INSERT INTO activity_logs (tenant_id, user_id, customer_id, type, title, metadata) VALUES ($1, $2, $3, $4, $5, $6::jsonb)",
    [auth.session.tenantId, auth.session.userId, id, paused ? "customer.reminders_paused" : "customer.reminders_resumed", paused ? "Customer reminders paused" : "Customer reminders resumed", JSON.stringify({ paused })]
  );
  return Response.json({ ok: true, customer: result.rows[0] });
}
