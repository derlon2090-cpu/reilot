import { normalizeEvolutionPhone } from "../../../../src/lib/evolution.js";
import { hasCustomerIdentity, validateOptionalEmail } from "../../../../src/lib/customerValidation.js";
import { query, transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function PATCH(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const hasEmail = Object.prototype.hasOwnProperty.call(body, "email");
  const emailResult = validateOptionalEmail(body.email);
  if (hasEmail && !emailResult.ok) return Response.json({ ok: false, reason: emailResult.reason, message: emailResult.message }, { status: 400 });
  const normalized = body.phoneNumber || body.phone ? normalizeEvolutionPhone(body.phoneNumber || body.phone) : { ok: true, phoneNumber: null };
  if (!normalized.ok) return Response.json({ ok: false, reason: "invalid_phone" }, { status: 400 });
  if ((Object.prototype.hasOwnProperty.call(body, "name") || Object.prototype.hasOwnProperty.call(body, "phone"))
      && !hasCustomerIdentity({ name: body.name, phone: normalized.phoneNumber })) {
    return Response.json({ ok: false, reason: "missing_customer_identity", message: "أدخل اسم العميل أو رقم الجوال." }, { status: 400 });
  }
  const result = await query(
    `UPDATE customers SET
       name = COALESCE(NULLIF($1, ''), name), email = CASE WHEN $2 THEN $3 ELSE email END,
       phone = COALESCE($4, phone), whatsapp_number = COALESCE($4, whatsapp_number),
       status = COALESCE($5, status), tags = COALESCE($6::jsonb, tags), updated_at = now()
      WHERE id = $7 AND tenant_id = $8
      RETURNING id, name, email, phone, whatsapp_number AS "whatsappNumber", status, tags`,
    [body.name ?? null, hasEmail, emailResult.email, normalized.phoneNumber, body.status || null, body.tags ? JSON.stringify(body.tags) : null, id, auth.session.tenantId]
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
