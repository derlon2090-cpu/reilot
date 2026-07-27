import { requireSession } from "../../../../../../src/server/session.js";
import { query, transaction } from "../../../../../../src/server/db.js";
import { createWebhookSecret, encryptWebhookSecret, CUSTOM_EVENTS, validateWebhookUrl } from "../../../../../../src/server/custom-integrations.js";

export async function GET(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { integrationId } = await params;
  const result = await query(
    `SELECT w.id,w.url,w.description,w.event_types AS events,w.status,
            w.last_tested_at AS "lastTestedAt",w.last_success_at AS "lastSuccessAt",
            w.last_failure_at AS "lastFailureAt",w.failure_count AS "failureCount",
            w.created_at AS "createdAt"
       FROM custom_integration_webhook_endpoints w
       JOIN custom_integrations i ON i.id=w.integration_id AND i.tenant_id=w.tenant_id
      WHERE w.integration_id=$1 AND w.tenant_id=$2 ORDER BY w.created_at DESC`,
    [integrationId, auth.session.tenantId]
  );
  return Response.json({ ok: true, items: result.rows });
}

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { integrationId } = await params;
  const body = await req.json().catch(() => ({}));
  const valid = await validateWebhookUrl(body.url);
  if (!valid.ok) return Response.json({ ok: false, reason: valid.reason }, { status: 400 });
  const events = [...new Set((Array.isArray(body.events) ? body.events : []).filter((type) => CUSTOM_EVENTS.has(type)))];
  if (!events.length) return Response.json({ ok: false, reason: "events_required" }, { status: 400 });
  const secret = createWebhookSecret();
  const item = await transaction(async (client) => {
    const owner = await client.query("SELECT id FROM custom_integrations WHERE id=$1 AND tenant_id=$2", [integrationId, auth.session.tenantId]);
    if (!owner.rows[0]) return null;
    const inserted = await client.query(
      `INSERT INTO custom_integration_webhook_endpoints
         (integration_id,tenant_id,url,description,event_types,signing_secret_encrypted,created_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
       RETURNING id,url,status,event_types AS events`,
      [integrationId, auth.session.tenantId, valid.url, body.description || null, JSON.stringify(events),
        encryptWebhookSecret(secret), auth.session.userId]
    );
    await client.query("UPDATE custom_integrations SET status='PARTIALLY_CONFIGURED',updated_at=now() WHERE id=$1", [integrationId]);
    return inserted.rows[0];
  });
  if (!item) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  return Response.json({ ok: true, item, signingSecret: secret, warning: "انسخ سر التوقيع الآن. لن يظهر كاملًا مرة أخرى." }, { status: 201 });
}
