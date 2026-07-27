import { requireSession } from "../../../../../../../src/server/session.js";
import { query, transaction } from "../../../../../../../src/server/db.js";

export async function DELETE(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  if (!["owner", "admin", "ADMIN"].includes(auth.session.role)) {
    return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }
  const { integrationId, keyId } = await params;
  const revoked = await transaction(async (client) => {
    const result = await client.query(
      `UPDATE custom_integration_api_keys
          SET revoked_at=COALESCE(revoked_at,now())
        WHERE id=$1 AND integration_id=$2 AND tenant_id=$3
        RETURNING id,key_prefix AS prefix,revoked_at AS "revokedAt"`,
      [keyId, integrationId, auth.session.tenantId]
    );
    if (!result.rows[0]) return null;
    await client.query(
      `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
       VALUES ($1,$2,'api_key.revoked','API key revoked',$3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ integrationId, keyId })]
    );
    return result.rows[0];
  });
  if (!revoked) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  return Response.json({ ok: true, item: revoked });
}
