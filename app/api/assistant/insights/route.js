import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT
      count(*) FILTER (WHERE end_date BETWEEN current_date AND current_date + 3)::int AS "expiringThreeDays",
      count(*) FILTER (WHERE status = 'expired')::int AS expired,
      count(*) FILTER (WHERE status = 'expired' AND updated_at < now() - interval '7 days')::int AS "needsFollowup"
     FROM subscriptions WHERE tenant_id = $1`,
    [auth.session.tenantId]
  );
  const metrics = result.rows[0];
  return Response.json({ ok: true, metrics, insights: [
    { type: "expiring", value: metrics.expiringThreeDays },
    { type: "expired", value: metrics.expired },
    { type: "manual_followup", value: metrics.needsFollowup }
  ] });
}
