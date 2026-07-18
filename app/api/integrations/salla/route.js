import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

function configured() {
  return Boolean(process.env.SALLA_CLIENT_ID && process.env.SALLA_CLIENT_SECRET && process.env.ENCRYPTION_KEY);
}

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT id, status, store_name AS "storeName", auto_sync AS "autoSync",
            default_duration_days AS "defaultDurationDays", last_sync_at AS "lastSyncAt",
            last_webhook_at AS "lastWebhookAt", last_error AS "lastError"
       FROM commerce_integrations WHERE tenant_id = $1 AND provider = 'salla' LIMIT 1`,
    [auth.session.tenantId]
  );
  return Response.json({ ok: true, configured: configured(), integration: result.rows[0] || null });
}

export async function PATCH(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const duration = Math.max(1, Math.min(3650, Number(body.defaultDurationDays) || 30));
  const result = await query(
    `UPDATE commerce_integrations
        SET auto_sync = CASE WHEN status = 'connected' THEN $1 ELSE false END,
            default_duration_days = $2, updated_at = now()
      WHERE tenant_id = $3 AND provider = 'salla'
      RETURNING id, status, store_name AS "storeName", auto_sync AS "autoSync",
                default_duration_days AS "defaultDurationDays", last_sync_at AS "lastSyncAt",
                last_webhook_at AS "lastWebhookAt", last_error AS "lastError"`,
    [body.autoSync === true, duration, auth.session.tenantId]
  );
  if (!result.rowCount) return Response.json({ ok: false, message: "اربط متجر سلة أولًا." }, { status: 409 });
  return Response.json({ ok: true, integration: result.rows[0] });
}

export async function DELETE(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  await query(
    `UPDATE commerce_integrations SET status = 'disconnected', auto_sync = false,
            access_token_encrypted = NULL, refresh_token_encrypted = NULL,
            token_expires_at = NULL, updated_at = now()
      WHERE tenant_id = $1 AND provider = 'salla'`,
    [auth.session.tenantId]
  );
  await query("INSERT INTO activity_logs (tenant_id, user_id, type, title) VALUES ($1, $2, 'salla.disconnected', 'Salla store disconnected')", [auth.session.tenantId, auth.session.userId]);
  return Response.json({ ok: true });
}
