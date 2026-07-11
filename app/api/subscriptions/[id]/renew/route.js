import { renewedEndDate } from "../../../../../src/lib/renewal.js";
import { transaction } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json();
  try {
    const result = await transaction(async (client) => {
      const existing = await client.query("SELECT id, end_date FROM subscriptions WHERE id = $1 AND tenant_id = $2 FOR UPDATE", [id, auth.session.tenantId]);
      if (!existing.rows[0]) return null;
      const rawEndDate = existing.rows[0].end_date;
      const currentEndDate = rawEndDate instanceof Date ? rawEndDate.toISOString().slice(0, 10) : String(rawEndDate);
      const endDate = renewedEndDate(currentEndDate, body.duration, body.customDate);
      const updated = await client.query(
        `UPDATE subscriptions SET end_date = $1, status = 'active', renewed_at = now(), renewed_by = $2, updated_at = now()
          WHERE id = $3 RETURNING id, end_date AS "endDate", status`,
        [endDate, auth.session.userId, id]
      );
      await client.query(
        `INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata)
         VALUES ($1, $2, 'subscription.renewed', 'Subscription renewed', $3::jsonb)`,
        [auth.session.tenantId, auth.session.userId, JSON.stringify({ subscriptionId: id, duration: body.duration, endDate })]
      );
      return updated.rows[0];
    });
    return result ? Response.json({ ok: true, subscription: result }) : Response.json({ ok: false }, { status: 404 });
  } catch {
    return Response.json({ ok: false, reason: "invalid_duration" }, { status: 400 });
  }
}
