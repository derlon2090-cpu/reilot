import { query } from "../../../../../../src/server/db.js";
import { requireSession } from "../../../../../../src/server/session.js";

export async function DELETE(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (id === auth.session.id) return Response.json({ ok: false, reason: "current_session" }, { status: 400 });
  const result = await query("DELETE FROM sessions WHERE id = $1 AND user_id = $2", [id, auth.session.userId]);
  if (!result.rowCount) return Response.json({ ok: false, reason: "session_not_found" }, { status: 404 });
  await query(
    `INSERT INTO activity_logs (tenant_id, user_id, type, title)
     VALUES ($1, $2, 'session.revoked', 'Session revoked')`,
    [auth.session.tenantId, auth.session.userId]
  );
  return Response.json({ ok: true });
}
