import { query } from "../../../src/server/db.js";
import { normalizePhone } from "../../../src/server/security.js";
import { requireSession } from "../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT id, phone_number AS "phoneNumber", reason, source, keyword, unsubscribed_at AS "unsubscribedAt"
       FROM unsubscribe_list WHERE tenant_id = $1 ORDER BY unsubscribed_at DESC LIMIT 200`,
    [auth.session.tenantId]
  );
  return Response.json({ ok: true, items: result.rows });
}
export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const phone = normalizePhone(body.phoneNumber);
  if (!/^[1-9]\d{9,14}$/.test(phone)) return Response.json({ ok: false, reason: "invalid_phone" }, { status: 400 });
  const result = await query(
    `INSERT INTO unsubscribe_list (tenant_id, phone_number, reason, source, keyword)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, phone_number) DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source, keyword = EXCLUDED.keyword, unsubscribed_at = now()
     RETURNING id, phone_number AS "phoneNumber", reason, source, keyword, unsubscribed_at AS "unsubscribedAt"`,
    [auth.session.tenantId, phone, body.reason || "User request", body.source || "manual", body.keyword || null]
  );
  await query(
    "INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata) VALUES ($1, $2, 'unsubscribe.added', 'Contact unsubscribed', $3::jsonb)",
    [auth.session.tenantId, auth.session.userId, JSON.stringify({ phoneNumber: phone })]
  );
  return Response.json({ ok: true, item: result.rows[0] }, { status: 201 });
}

export async function DELETE(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ ok: false, reason: "missing_id" }, { status: 400 });
  const result = await query("DELETE FROM unsubscribe_list WHERE id = $1 AND tenant_id = $2 RETURNING phone_number", [id, auth.session.tenantId]);
  if (!result.rows[0]) return Response.json({ ok: false }, { status: 404 });
  await query(
    "INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata) VALUES ($1, $2, 'unsubscribe.removed', 'Contact resubscribed', $3::jsonb)",
    [auth.session.tenantId, auth.session.userId, JSON.stringify({ phoneNumber: result.rows[0].phone_number })]
  );
  return Response.json({ ok: true });
}
