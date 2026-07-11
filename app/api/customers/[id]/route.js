import { normalizeEvolutionPhone } from "../../../../src/lib/evolution.js";
import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function PATCH(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const normalized = normalizeEvolutionPhone(body.phoneNumber);
  if (!normalized.ok) return Response.json({ ok: false, reason: "invalid_phone" }, { status: 400 });
  const result = await query(
    `UPDATE customers SET phone = $1, whatsapp_number = $1, updated_at = now()
      WHERE id = $2 AND tenant_id = $3 RETURNING id, phone, whatsapp_number AS "whatsappNumber"`,
    [normalized.phoneNumber, id, auth.session.tenantId]
  );
  if (!result.rows[0]) return Response.json({ ok: false }, { status: 404 });
  await query("INSERT INTO activity_logs (tenant_id, user_id, customer_id, type, title) VALUES ($1, $2, $3, 'customer.phone_updated', 'Customer phone updated')", [auth.session.tenantId, auth.session.userId, id]);
  return Response.json({ ok: true, customer: result.rows[0] });
}
