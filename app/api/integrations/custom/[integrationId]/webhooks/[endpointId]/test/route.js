import crypto from "node:crypto";
import { requireSession } from "../../../../../../../../src/server/session.js";
import { transaction } from "../../../../../../../../src/server/db.js";

function canManage(role) {
  return ["owner", "admin", "ADMIN"].includes(role);
}

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  if (!canManage(auth.session.role)) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  const { integrationId, endpointId } = await params;
  const identifier = `${auth.session.tenantId}:${auth.session.userId}:${endpointId}`;
  const result = await transaction(async (client) => {
    const endpoint = await client.query(
      `SELECT w.id,w.status
         FROM custom_integration_webhook_endpoints w
         JOIN custom_integrations i ON i.id=w.integration_id AND i.tenant_id=w.tenant_id
        WHERE w.id=$1 AND w.integration_id=$2 AND w.tenant_id=$3 FOR UPDATE`,
      [endpointId, integrationId, auth.session.tenantId]
    );
    if (!endpoint.rows[0]) return { status: 404, body: { ok: false, reason: "not_found" } };
    const usage = await client.query(
      `SELECT count(*)::int AS count FROM custom_api_rate_limit_hits
        WHERE identifier_hash=encode(digest($1,'sha256'),'hex') AND route_key='webhook:test'
          AND created_at > now() - interval '1 hour'`,
      [identifier]
    );
    if (Number(usage.rows[0]?.count || 0) >= 10) {
      return { status: 429, body: { ok: false, reason: "rate_limit_exceeded" } };
    }
    await client.query(
      `INSERT INTO custom_api_rate_limit_hits (identifier_hash,route_key)
       VALUES (encode(digest($1,'sha256'),'hex'),'webhook:test')`,
      [identifier]
    );
    const publicEventId = `evt_${crypto.randomBytes(16).toString("base64url")}`;
    const envelope = {
      id: publicEventId,
      type: "integration.test",
      api_version: "v1",
      created_at: new Date().toISOString(),
      data: { object: { integration_id: integrationId, endpoint_id: endpointId, test: true } }
    };
    const event = await client.query(
      `INSERT INTO custom_integration_events
         (integration_id,tenant_id,direction,event_type,external_event_id,resource_type,resource_id,payload,status)
       VALUES ($1,$2,'outbound','integration.test',$3,'integration',$1,$4::jsonb,'queued') RETURNING id`,
      [integrationId, auth.session.tenantId, publicEventId, JSON.stringify(envelope)]
    );
    const delivery = await client.query(
      `INSERT INTO custom_integration_webhook_deliveries
         (endpoint_id,integration_id,tenant_id,event_id,event_type,payload,idempotency_key)
       VALUES ($1,$2,$3,$4,'integration.test',$5::jsonb,$6) RETURNING id,status,created_at AS "createdAt"`,
      [endpointId, integrationId, auth.session.tenantId, event.rows[0].id, JSON.stringify(envelope), `${endpointId}:${publicEventId}`]
    );
    await client.query(
      `UPDATE custom_integration_webhook_endpoints SET last_tested_at=now(),updated_at=now() WHERE id=$1`,
      [endpointId]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
       VALUES ($1,$2,'webhook.test_queued','Webhook test queued',$3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ integrationId, endpointId, eventId: publicEventId, deliveryId: delivery.rows[0].id })]
    );
    return { status: 202, body: { ok: true, queued: true, eventId: publicEventId, delivery: delivery.rows[0] } };
  });
  return Response.json(result.body, { status: result.status, headers: result.status === 429 ? { "Retry-After": "3600" } : undefined });
}
