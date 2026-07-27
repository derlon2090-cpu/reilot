import { requireSession } from "../../../../../../src/server/session.js";
import { query } from "../../../../../../src/server/db.js";

export async function GET(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { integrationId } = await params;
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 25));
  const before = url.searchParams.get("before");
  const result = await query(
    `SELECT d.id,d.event_id AS "eventId",d.event_type AS "eventType",w.url,
            d.status,d.response_status AS "httpStatus",d.response_body_safe AS "safeResponse",
            d.error_code AS "errorCode",d.attempts,d.max_attempts AS "maxAttempts",
            d.next_attempt_at AS "nextAttemptAt",d.delivered_at AS "deliveredAt",
            d.created_at AS "createdAt",d.updated_at AS "updatedAt"
       FROM custom_integration_webhook_deliveries d
       JOIN custom_integration_webhook_endpoints w
         ON w.id=d.endpoint_id AND w.tenant_id=d.tenant_id
       JOIN custom_integrations i ON i.id=d.integration_id AND i.tenant_id=d.tenant_id
      WHERE d.integration_id=$1 AND d.tenant_id=$2
        AND ($3::timestamptz IS NULL OR d.created_at < $3::timestamptz)
      ORDER BY d.created_at DESC LIMIT $4`,
    [integrationId, auth.session.tenantId, before || null, limit]
  );
  return Response.json({ ok: true, items: result.rows, nextCursor: result.rows.at(-1)?.createdAt || null });
}
