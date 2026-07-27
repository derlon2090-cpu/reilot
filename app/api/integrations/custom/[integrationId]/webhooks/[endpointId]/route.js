import { requireSession } from "../../../../../../../src/server/session.js";
import { query, transaction } from "../../../../../../../src/server/db.js";
import {
  createWebhookSecret,
  encryptWebhookSecret,
  CUSTOM_EVENTS,
  validateWebhookUrl
} from "../../../../../../../src/server/custom-integrations.js";

function canManage(role) {
  return ["owner", "admin", "ADMIN"].includes(role);
}

export async function PATCH(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  if (!canManage(auth.session.role)) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  const { integrationId, endpointId } = await params;
  const body = await req.json().catch(() => ({}));
  const current = await query(
    `SELECT id,url,description,event_types,status
       FROM custom_integration_webhook_endpoints
      WHERE id=$1 AND integration_id=$2 AND tenant_id=$3`,
    [endpointId, integrationId, auth.session.tenantId]
  );
  if (!current.rows[0]) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  let url = current.rows[0].url;
  if (body.url !== undefined) {
    const valid = await validateWebhookUrl(body.url);
    if (!valid.ok) return Response.json({ ok: false, reason: valid.reason }, { status: 400 });
    url = valid.url;
  }
  const events = body.events === undefined
    ? current.rows[0].event_types
    : [...new Set((Array.isArray(body.events) ? body.events : []).filter((type) => CUSTOM_EVENTS.has(type)))];
  if (!events.length) return Response.json({ ok: false, reason: "events_required" }, { status: 400 });
  const status = body.status === undefined ? current.rows[0].status : String(body.status);
  if (!["enabled", "disabled"].includes(status)) return Response.json({ ok: false, reason: "validation_error" }, { status: 400 });
  const rotateSecret = body.rotateSecret === true;
  const secret = rotateSecret ? createWebhookSecret() : null;
  const item = await transaction(async (client) => {
    const updated = await client.query(
      `UPDATE custom_integration_webhook_endpoints
          SET url=$4,description=$5,event_types=$6::jsonb,status=$7,
              signing_secret_encrypted=CASE WHEN $8::text IS NULL THEN signing_secret_encrypted ELSE $8 END,
              failure_count=CASE WHEN $7='enabled' THEN 0 ELSE failure_count END,updated_at=now()
        WHERE id=$1 AND integration_id=$2 AND tenant_id=$3
        RETURNING id,url,description,event_types AS events,status,updated_at AS "updatedAt"`,
      [
        endpointId,
        integrationId,
        auth.session.tenantId,
        url,
        body.description === undefined ? current.rows[0].description : String(body.description || "").slice(0, 500) || null,
        JSON.stringify(events),
        status,
        secret ? encryptWebhookSecret(secret) : null
      ]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
       VALUES ($1,$2,$3,'Webhook endpoint updated',$4::jsonb)`,
      [
        auth.session.tenantId,
        auth.session.userId,
        rotateSecret ? "webhook.secret_rotated" : status === "disabled" ? "webhook.disabled" : "webhook.updated",
        JSON.stringify({ integrationId, endpointId, status })
      ]
    );
    return updated.rows[0];
  });
  return Response.json({
    ok: true,
    item,
    ...(secret ? { signingSecret: secret, warning: "انسخ سر التوقيع الجديد الآن. لن يظهر كاملًا مرة أخرى." } : {})
  });
}

export async function DELETE(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  if (!canManage(auth.session.role)) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  const { integrationId, endpointId } = await params;
  const result = await query(
    "DELETE FROM custom_integration_webhook_endpoints WHERE id=$1 AND integration_id=$2 AND tenant_id=$3 RETURNING id",
    [endpointId, integrationId, auth.session.tenantId]
  );
  if (!result.rows[0]) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
