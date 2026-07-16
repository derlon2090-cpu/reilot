import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function DELETE(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await query("DELETE FROM order_info_links WHERE id = $1 AND tenant_id = $2 RETURNING id", [id, auth.session.tenantId]);
  return result.rows[0] ? Response.json({ ok: true }) : Response.json({ ok: false, reason: "not_found" }, { status: 404 });
}
