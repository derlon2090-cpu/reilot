import { requireSession } from "../../../../../../src/server/session.js";
import { query, transaction } from "../../../../../../src/server/db.js";
import { createApiKey, normalizeScopes } from "../../../../../../src/server/custom-integrations.js";
import { requirePlanEntitlement, planEntitlementResponse } from "../../../../../../src/server/plan-entitlements.js";

function canManage(role) {
  return ["owner", "admin", "ADMIN"].includes(role);
}

export async function GET(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { integrationId } = await params;
  const result = await query(
    `SELECT k.id,k.name,k.key_prefix AS prefix,k.scopes,k.last_used_at AS "lastUsedAt",
            k.expires_at AS "expiresAt",k.revoked_at AS "revokedAt",k.created_at AS "createdAt"
       FROM custom_integration_api_keys k
       JOIN custom_integrations i ON i.id=k.integration_id AND i.tenant_id=k.tenant_id
      WHERE k.integration_id=$1 AND k.tenant_id=$2 ORDER BY k.created_at DESC`,
    [integrationId, auth.session.tenantId]
  );
  return Response.json({ ok: true, items: result.rows });
}

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  if (!canManage(auth.session.role)) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  try { await requirePlanEntitlement(auth.session.tenantId, "api_access"); }
  catch (error) { const response = planEntitlementResponse(error); if (response) return response; throw error; }
  const { integrationId } = await params;
  const body = await req.json().catch(() => ({}));
  const identifier = `${auth.session.tenantId}:${auth.session.userId}:${integrationId}`;
  const recent = await query(
    `SELECT count(*)::int AS count FROM custom_api_rate_limit_hits
      WHERE identifier_hash=encode(digest($1,'sha256'),'hex') AND route_key='api-key:create'
        AND created_at > now() - interval '1 hour'`,
    [identifier]
  );
  if (Number(recent.rows[0]?.count || 0) >= 5) {
    return Response.json({ ok: false, reason: "rate_limit_exceeded" }, {
      status: 429,
      headers: { "Retry-After": "3600", "X-RateLimit-Limit": "5", "X-RateLimit-Remaining": "0" }
    });
  }
  const owner = await query(
    "SELECT environment,scopes FROM custom_integrations WHERE id=$1 AND tenant_id=$2 AND status <> 'REVOKED'",
    [integrationId, auth.session.tenantId]
  );
  if (!owner.rows[0]) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  const scopes = normalizeScopes(body.scopes === undefined ? owner.rows[0].scopes : body.scopes);
  if (!scopes.length) return Response.json({ ok: false, reason: "scopes_required" }, { status: 400 });
  const key = createApiKey(owner.rows[0].environment);
  const item = await transaction(async (client) => {
    await client.query(
      `INSERT INTO custom_api_rate_limit_hits (identifier_hash,route_key)
       VALUES (encode(digest($1,'sha256'),'hex'),'api-key:create')`,
      [identifier]
    );
    const inserted = await client.query(
      `INSERT INTO custom_integration_api_keys
         (integration_id,tenant_id,name,public_key_id,key_prefix,key_digest,environment,status,scopes,expires_at,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVE',$8::jsonb,$9,$10)
       RETURNING id,name,key_prefix AS prefix,scopes,expires_at AS "expiresAt",created_at AS "createdAt"`,
      [
        integrationId,
        auth.session.tenantId,
        String(body.name || "مفتاح API").slice(0, 120),
        key.publicKeyId,
        key.prefix,
        key.digest,
        key.environment,
        JSON.stringify(scopes),
        body.expiresAt || null,
        auth.session.userId
      ]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
       VALUES ($1,$2,'api_key.created','API key created',$3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ integrationId, keyId: inserted.rows[0].id, prefix: key.prefix })]
    );
    return inserted.rows[0];
  });
  return Response.json(
    { ok: true, item, apiKey: key.raw, warning: "انسخ المفتاح الآن. لن يظهر كاملًا مرة أخرى." },
    { status: 201 }
  );
}
