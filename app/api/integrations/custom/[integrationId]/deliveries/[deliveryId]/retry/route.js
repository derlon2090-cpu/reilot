import { requireSession } from "../../../../../../../../src/server/session.js";
import { query, transaction } from "../../../../../../../../src/server/db.js";

function canManage(role) {
  return ["owner", "admin", "ADMIN"].includes(role);
}

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  if (!canManage(auth.session.role)) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  const { integrationId, deliveryId } = await params;
  const item = await transaction(async (client) => {
    const updated = await client.query(
      `UPDATE custom_integration_webhook_deliveries
          SET status='pending',next_attempt_at=now(),response_status=NULL,
              response_body_safe=NULL,error_code=NULL,updated_at=now()
        WHERE id=$1 AND integration_id=$2 AND tenant_id=$3 AND status='failed'
        RETURNING id,status,attempts,next_attempt_at AS "nextAttemptAt"`,
      [deliveryId, integrationId, auth.session.tenantId]
    );
    if (!updated.rows[0]) return null;
    await client.query(
      `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
       VALUES ($1,$2,'webhook.delivery_retried','Webhook delivery retried',$3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ integrationId, deliveryId })]
    );
    return updated.rows[0];
  });
  if (!item) return Response.json({ ok: false, reason: "not_found_or_not_failed" }, { status: 404 });
  return Response.json({ ok: true, item }, { status: 202 });
}
