import { requireSession } from "../../../../../src/server/session.js";
import { query, transaction } from "../../../../../src/server/db.js";
import { normalizeScopes } from "../../../../../src/server/custom-integrations.js";

function canManage(role) {
  return ["owner", "admin", "ADMIN"].includes(role);
}

export async function GET(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { integrationId } = await params;
  const result = await query(
    `SELECT i.id,i.name,i.description,i.environment,i.direction,i.status,i.scopes,
            i.last_success_at AS "lastApiRequestAt",i.last_error_at AS "lastErrorAt",
            i.last_error_code AS "lastErrorCode",i.created_at AS "createdAt",i.updated_at AS "updatedAt",
            COALESCE((SELECT count(*) FROM custom_integration_events e
                       WHERE e.integration_id=i.id AND e.created_at > now() - interval '24 hours'),0)::int AS "events24h",
            COALESCE((SELECT count(*) FROM custom_integration_webhook_deliveries d
                       WHERE d.integration_id=i.id AND d.status='failed'),0)::int AS "deliveryErrors"
       FROM custom_integrations i
      WHERE i.id=$1 AND i.tenant_id=$2 LIMIT 1`,
    [integrationId, auth.session.tenantId]
  );
  if (!result.rows[0]) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  return Response.json({ ok: true, item: result.rows[0] });
}

export async function PATCH(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  if (!canManage(auth.session.role)) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  const { integrationId } = await params;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const status = String(body.status || "").toUpperCase();
  const environment = String(body.environment || "").toLowerCase();
  const direction = String(body.direction || "").toLowerCase();
  const scopes = body.scopes === undefined ? null : normalizeScopes(body.scopes);
  if (body.name !== undefined && !name) return Response.json({ ok: false, reason: "validation_error" }, { status: 400 });
  if (body.status !== undefined && !["ACTIVE", "PAUSED", "REVOKED"].includes(status)) {
    return Response.json({ ok: false, reason: "validation_error" }, { status: 400 });
  }
  if (body.environment !== undefined && !["test", "live"].includes(environment)) {
    return Response.json({ ok: false, reason: "validation_error" }, { status: 400 });
  }
  if (body.direction !== undefined && !["inbound", "outbound", "bidirectional"].includes(direction)) {
    return Response.json({ ok: false, reason: "validation_error" }, { status: 400 });
  }
  const item = await transaction(async (client) => {
    const current = await client.query(
      "SELECT id,name,description,status,scopes,environment,direction FROM custom_integrations WHERE id=$1 AND tenant_id=$2 FOR UPDATE",
      [integrationId, auth.session.tenantId]
    );
    if (!current.rows[0]) return null;
    const updated = await client.query(
      `UPDATE custom_integrations
          SET name=$3,description=$4,status=$5,scopes=$6::jsonb,environment=$7,direction=$8,updated_at=now()
        WHERE id=$1 AND tenant_id=$2
        RETURNING id,name,description,environment,direction,status,scopes,updated_at AS "updatedAt"`,
      [
        integrationId,
        auth.session.tenantId,
        body.name === undefined ? current.rows[0].name : name,
        body.description === undefined ? current.rows[0].description : String(body.description || "").slice(0, 1000) || null,
        body.status === undefined ? current.rows[0].status : status,
        JSON.stringify(scopes === null ? current.rows[0].scopes : scopes),
        body.environment === undefined ? current.rows[0].environment : environment,
        body.direction === undefined ? current.rows[0].direction : direction
      ]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
       VALUES ($1,$2,$3,'Custom integration updated',$4::jsonb)`,
      [
        auth.session.tenantId,
        auth.session.userId,
        status === "PAUSED" ? "custom_integration.paused" : "custom_integration.updated",
        JSON.stringify({ integrationId, status: updated.rows[0].status })
      ]
    );
    return updated.rows[0];
  });
  if (!item) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  return Response.json({ ok: true, item });
}
