import { query, transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";
import {
  ensureSallaCustomerLoginWebhook,
  getSallaAccessToken
} from "../../../../src/server/salla-app.js";

export async function PATCH(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") {
    return Response.json({ ok: false, message: "حالة المزامنة غير صالحة." }, { status: 400 });
  }

  const connected = await query(
    `SELECT id, access_token_encrypted, refresh_token_encrypted, token_expires_at
       FROM app_connections
      WHERE tenant_id = $1 AND provider = 'salla' AND status = 'connected'
      LIMIT 1`,
    [auth.session.tenantId]
  );
  if (!connected.rows[0]) {
    return Response.json(
      { ok: false, message: "اربط متجر سلة أولًا لتفعيل حفظ العملاء تلقائيًا." },
      { status: 409 }
    );
  }
  if (body.enabled) {
    try {
      const accessToken = await getSallaAccessToken(connected.rows[0]);
      await ensureSallaCustomerLoginWebhook(accessToken, new URL(req.url).origin);
    } catch {
      return Response.json(
        { ok: false, message: "تعذر تفعيل استقبال تسجيلات دخول العملاء من سلة. حاول مرة أخرى." },
        { status: 502 }
      );
    }
  }

  const result = await transaction(async (client) => {
    const connection = await client.query(
      `SELECT id FROM app_connections
        WHERE tenant_id = $1 AND provider = 'salla' AND status = 'connected'
        LIMIT 1 FOR UPDATE`,
      [auth.session.tenantId]
    );
    if (!connection.rows[0]) return null;

    await client.query(
      `INSERT INTO salla_connection_settings (tenant_id, connection_id, auto_sync_customers)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, connection_id) DO UPDATE SET
         auto_sync_customers = EXCLUDED.auto_sync_customers,
         updated_at = now()`,
      [auth.session.tenantId, connection.rows[0].id, body.enabled]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata)
       VALUES ($1, $2, 'settings.store_customer_sync_updated', $3, $4::jsonb)`,
      [
        auth.session.tenantId,
        auth.session.userId,
        body.enabled ? "Store customer sync enabled" : "Store customer sync disabled",
        JSON.stringify({ enabled: body.enabled, provider: "salla" })
      ]
    );
    return { enabled: body.enabled };
  });

  if (!result) return Response.json({ ok: false, message: "انقطع ربط متجر سلة أثناء الحفظ." }, { status: 409 });
  return Response.json({ ok: true, available: true, enabled: result.enabled });
}
