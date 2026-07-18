import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import { getSallaAccessToken, processSallaEvent } from "../../../../../src/server/salla-app.js";

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(`SELECT ac.id, ac.provider_store_id, ac.access_token_encrypted,
    ac.refresh_token_encrypted, ac.token_expires_at, ac.status,
    scs.auto_sync_customers, scs.auto_sync_orders
    FROM app_connections ac
    LEFT JOIN salla_connection_settings scs ON scs.connection_id = ac.id AND scs.tenant_id = ac.tenant_id
    WHERE ac.tenant_id = $1 AND ac.provider = 'salla' LIMIT 1`, [auth.session.tenantId]);
  const connection = result.rows[0];
  if (!connection || connection.status !== "connected") return Response.json({ ok: false, message: "اربط متجر سلة أولًا." }, { status: 409 });
  try {
    const token = await getSallaAccessToken(connection);
    const base = (process.env.SALLA_API_BASE_URL || "https://api.salla.dev/admin/v2").replace(/\/$/, "");
    let synced = 0;
    if (connection.auto_sync_customers !== false) {
      const response = await fetch(`${base}/customers?per_page=50`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Salla customers request failed (${response.status})`);
      const customers = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.data?.data) ? payload.data.data : [];
      for (const customer of customers) {
        const item = await processSallaEvent({ event: "customer.updated", merchant: connection.provider_store_id, data: customer });
        if (item.ok && !item.skipped) synced += 1;
      }
    }
    if (connection.auto_sync_orders !== false) {
      const response = await fetch(`${base}/orders?per_page=50`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Salla orders request failed (${response.status})`);
      const orders = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.data?.data) ? payload.data.data : [];
      for (const order of orders) {
        const item = await processSallaEvent({ event: "order.updated", merchant: connection.provider_store_id, data: order });
        if (item.ok && !item.skipped) synced += 1;
      }
    }
    await query("UPDATE app_connections SET last_sync_at = now(), last_error = NULL, updated_at = now() WHERE id = $1", [connection.id]);
    return Response.json({ ok: true, synced });
  } catch (error) {
    await query("UPDATE app_connections SET last_error = $2, updated_at = now() WHERE id = $1", [connection.id, String(error.message).slice(0, 300)]);
    return Response.json({ ok: false, message: "تعذرت المزامنة، تحقق من صلاحيات الربط." }, { status: 502 });
  }
}
