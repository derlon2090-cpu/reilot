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
    `SELECT e.id,e.external_event_id AS "eventId",e.event_type AS "eventType",
            e.direction,e.resource_type AS "resourceType",e.resource_id AS "resourceId",
            e.status,e.error_code AS "errorCode",e.created_at AS "createdAt",
            e.processed_at AS "processedAt"
       FROM custom_integration_events e
       JOIN custom_integrations i ON i.id=e.integration_id AND i.tenant_id=e.tenant_id
      WHERE e.integration_id=$1 AND e.tenant_id=$2
        AND ($3::timestamptz IS NULL OR e.created_at < $3::timestamptz)
      ORDER BY e.created_at DESC LIMIT $4`,
    [integrationId, auth.session.tenantId, before || null, limit]
  );
  return Response.json({ ok: true, items: result.rows, nextCursor: result.rows.at(-1)?.createdAt || null });
}
