import { query } from "./db.js";

export async function recordOperationalIssue({
  tenantId,
  category,
  source,
  sourceId = null,
  severity = "error",
  message,
  suggestedSolution,
  metadata = {}
}) {
  if (!tenantId) return null;
  const result = await query(
    `INSERT INTO operational_issues
       (tenant_id, category, source, source_id, severity, message, suggested_solution, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING id`,
    [tenantId, category, source, sourceId, severity, message, suggestedSolution, JSON.stringify(metadata)]
  );
  return result.rows[0] || null;
}

export async function resolveOperationalIssues({ tenantId, category, sourceId = null }) {
  await query(
    `UPDATE operational_issues
        SET status = 'resolved', resolved_at = now(), updated_at = now()
      WHERE tenant_id = $1 AND category = $2 AND status = 'open'
        AND ($3::text IS NULL OR source_id = $3)`,
    [tenantId, category, sourceId]
  );
}
