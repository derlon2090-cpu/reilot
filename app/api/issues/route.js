import { query } from "../../../src/server/db.js";
import { requireSession } from "../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT id, category, source, source_id AS "sourceId", severity, status, message,
            suggested_solution AS "suggestedSolution", metadata, created_at AS "createdAt", resolved_at AS "resolvedAt"
       FROM operational_issues WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 300`,
    [auth.session.tenantId]
  );
  return Response.json({ ok: true, items: result.rows });
}
