import { requireSession } from "../../../../src/server/session.js";
import { query, transaction } from "../../../../src/server/db.js";
import { createApiKey, normalizeScopes } from "../../../../src/server/custom-integrations.js";
import { assertPlanFeature, planEntitlementResponse } from "../../../../src/server/plan-entitlements.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT i.id,i.name,i.description,i.environment,i.direction,i.status,i.scopes,
            i.last_success_at AS "lastApiRequestAt",i.last_error_at AS "lastErrorAt",
            i.created_at AS "createdAt",
            COALESCE((SELECT count(*) FROM custom_integration_api_keys k WHERE k.integration_id=i.id AND k.revoked_at IS NULL),0)::int AS "activeKeys",
            COALESCE((SELECT count(*) FROM custom_integration_webhook_endpoints w WHERE w.integration_id=i.id AND w.status='enabled'),0)::int AS "activeWebhooks",
            (SELECT k.key_prefix
               FROM custom_integration_api_keys k
              WHERE k.integration_id=i.id AND k.tenant_id=i.tenant_id AND k.revoked_at IS NULL
              ORDER BY k.created_at DESC LIMIT 1) AS "latestKeyPrefix",
            (SELECT k.last_used_at
               FROM custom_integration_api_keys k
              WHERE k.integration_id=i.id AND k.tenant_id=i.tenant_id AND k.revoked_at IS NULL
              ORDER BY k.created_at DESC LIMIT 1) AS "latestKeyUsedAt",
            COALESCE((
              SELECT jsonb_build_object(
                'id', w.id,
                'url', w.url,
                'status', w.status,
                'events', w.event_types,
                'lastTestedAt', w.last_tested_at,
                'lastSuccessAt', w.last_success_at,
                'lastFailureAt', w.last_failure_at,
                'failureCount', w.failure_count
              )
                FROM custom_integration_webhook_endpoints w
               WHERE w.integration_id=i.id AND w.tenant_id=i.tenant_id
               ORDER BY w.created_at DESC LIMIT 1
            ), '{}'::jsonb) AS webhook,
            COALESCE((SELECT count(*) FROM custom_integration_events e
                       WHERE e.integration_id=i.id AND e.tenant_id=i.tenant_id
                         AND e.created_at > now() - interval '24 hours'),0)::int AS "events24h",
            COALESCE((SELECT count(*) FROM custom_integration_webhook_deliveries d
                       WHERE d.integration_id=i.id AND d.tenant_id=i.tenant_id
                         AND d.status='delivered'
                         AND d.created_at > now() - interval '24 hours'),0)::int AS "delivered24h",
            COALESCE((SELECT count(*) FROM custom_integration_webhook_deliveries d
                       WHERE d.integration_id=i.id AND d.tenant_id=i.tenant_id
                         AND d.status IN ('pending','processing')),0)::int AS "pendingDeliveries",
            COALESCE((
              SELECT jsonb_agg(to_jsonb(recent_delivery))
                FROM (
                  SELECT d.id,
                         d.event_type AS "eventType",
                         d.status,
                         d.response_status AS "httpStatus",
                         d.attempts,
                         d.error_code AS "errorCode",
                         d.created_at AS "createdAt",
                         d.delivered_at AS "deliveredAt"
                    FROM custom_integration_webhook_deliveries d
                   WHERE d.integration_id=i.id AND d.tenant_id=i.tenant_id
                   ORDER BY d.created_at DESC
                   LIMIT 8
                ) recent_delivery
            ), '[]'::jsonb) AS "recentDeliveries"
       FROM custom_integrations i WHERE i.tenant_id=$1 ORDER BY i.created_at DESC`,
    [auth.session.tenantId]
  );
  return Response.json({ ok: true, items: result.rows });
}

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  if (!["owner", "admin", "ADMIN"].includes(auth.session.role)) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  try { await assertPlanFeature(auth.session.tenantId, "customApiEnabled"); }
  catch (error) { const response = planEntitlementResponse(error); if (response) return response; throw error; }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const scopes = normalizeScopes(body.scopes);
  if (!name || !scopes.length) return Response.json({ ok: false, reason: "validation_error" }, { status: 400 });
  const key = createApiKey(body.environment);
  const item = await transaction(async (client) => {
    const integration = await client.query(
      `INSERT INTO custom_integrations
         (tenant_id,name,description,environment,direction,status,scopes,created_by)
       VALUES ($1,$2,$3,$4,$5,'PARTIALLY_CONFIGURED',$6::jsonb,$7)
       RETURNING id,name,environment,direction,status`,
      [auth.session.tenantId, name, body.description || null, body.environment === "test" ? "test" : "live",
        ["inbound", "outbound", "bidirectional"].includes(body.direction) ? body.direction : "bidirectional",
        JSON.stringify(scopes), auth.session.userId]
    );
    await client.query(
      `INSERT INTO custom_integration_api_keys
         (integration_id,tenant_id,name,key_prefix,key_digest,scopes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [integration.rows[0].id, auth.session.tenantId, body.keyName || "المفتاح الرئيسي",
        key.prefix, key.digest, JSON.stringify(scopes), auth.session.userId]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
       VALUES ($1,$2,'custom_integration.created','Custom integration created',$3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ integrationId: integration.rows[0].id, keyPrefix: key.prefix })]
    );
    return integration.rows[0];
  });
  return Response.json({ ok: true, item, apiKey: key.raw, warning: "انسخ المفتاح الآن. لن يظهر كاملًا مرة أخرى." }, { status: 201 });
}
