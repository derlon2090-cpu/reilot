import { normalizeEvolutionPhone } from "../../../../src/lib/evolution.js";
import { query, transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function PATCH(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const normalized = body.phoneNumber || body.phone ? normalizeEvolutionPhone(body.phoneNumber || body.phone) : { ok: true, phoneNumber: null };
  if (!normalized.ok) return Response.json({ ok: false, reason: "invalid_phone" }, { status: 400 });
  const result = await query(
    `UPDATE customers SET
       name = COALESCE($1, name), email = COALESCE($2, email),
       phone = COALESCE($3, phone), whatsapp_number = COALESCE($3, whatsapp_number),
       status = COALESCE($4, status), tags = COALESCE($5::jsonb, tags), updated_at = now()
      WHERE id = $6 AND tenant_id = $7
      RETURNING id, name, email, phone, whatsapp_number AS "whatsappNumber", status, tags`,
    [body.name || null, body.email || null, normalized.phoneNumber, body.status || null, body.tags ? JSON.stringify(body.tags) : null, id, auth.session.tenantId]
  );
  if (!result.rows[0]) return Response.json({ ok: false }, { status: 404 });
  await query("INSERT INTO activity_logs (tenant_id, user_id, customer_id, type, title) VALUES ($1, $2, $3, 'customer.updated', 'Customer updated')", [auth.session.tenantId, auth.session.userId, id]);
  return Response.json({ ok: true, customer: result.rows[0] });
}

export async function DELETE(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const deleted = await transaction(async (client) => {
    const result = await client.query("DELETE FROM customers WHERE id = $1 AND tenant_id = $2 RETURNING id, name", [id, auth.session.tenantId]);
    if (!result.rows[0]) return null;
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata)
       VALUES ($1, $2, 'customer.deleted', 'Customer deleted', $3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ customerId: id, name: result.rows[0].name })]
    );
    return result.rows[0];
  });
  return deleted ? Response.json({ ok: true }) : Response.json({ ok: false }, { status: 404 });
}
