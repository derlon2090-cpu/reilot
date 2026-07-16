import { transaction } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";

export async function PATCH(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const item = await transaction(async (client) => {
    const updated = await client.query(
      `UPDATE order_info_links SET status = 'archived', updated_at = now()
        WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, auth.session.tenantId]
    );
    if (!updated.rows[0]) return null;
    await client.query("INSERT INTO order_link_events (tenant_id, order_info_link_id, event_type) VALUES ($1, $2, 'archived')", [auth.session.tenantId, id]);
    return updated.rows[0];
  });
  return item ? Response.json({ ok: true }) : Response.json({ ok: false, reason: "not_found" }, { status: 404 });
}
