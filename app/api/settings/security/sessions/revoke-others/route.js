import { query } from "../../../../../../src/server/db.js";
import { requireSession } from "../../../../../../src/server/session.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const result = await query("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [auth.session.userId, auth.session.id]);
  await query(
    `INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata)
     VALUES ($1, $2, 'session.revoked', 'Other sessions revoked', $3::jsonb)`,
    [auth.session.tenantId, auth.session.userId, JSON.stringify({ count: result.rowCount })]
  );
  return Response.json({ ok: true, revoked: result.rowCount });
}
