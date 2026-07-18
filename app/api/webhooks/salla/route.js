import crypto from "node:crypto";
import { query, transaction } from "../../../../src/server/db.js";
import { normalizeSallaOrder, verifySallaWebhook } from "../../../../src/lib/salla.js";

export async function POST(req) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-salla-signature") || req.headers.get("x-salla-hmac-sha256") || "";
  if (!verifySallaWebhook(rawBody, signature)) return Response.json({ ok: false }, { status: 401 });
  const payload = (() => { try { return JSON.parse(rawBody); } catch { return null; } })();
  if (!payload) return Response.json({ ok: false, message: "Invalid JSON payload" }, { status: 400 });
  const event = String(payload.event || payload.type || "");
  if (!event.startsWith("order.")) return Response.json({ ok: true, ignored: true });
  const merchantId = String(payload.merchant || payload.merchant_id || payload.data?.merchant?.id || "").trim();
  if (!merchantId) return Response.json({ ok: true, ignored: true });
  const integrationResult = await query(
    `SELECT id, tenant_id AS "tenantId", default_duration_days AS "defaultDurationDays"
       FROM commerce_integrations WHERE provider = 'salla' AND merchant_id = $1
        AND status = 'connected' AND auto_sync = true LIMIT 1`,
    [merchantId]
  );
  const integration = integrationResult.rows[0];
  if (!integration) return Response.json({ ok: true, ignored: true });
  const order = normalizeSallaOrder(payload, integration.defaultDurationDays);
  if (!order.externalOrderId || !order.orderNumber) return Response.json({ ok: false, message: "Order id is missing" }, { status: 422 });
  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  await transaction(async (client) => {
    let customer = await client.query(
      `SELECT id FROM customers WHERE tenant_id = $1 AND
       (($2::text IS NOT NULL AND COALESCE(whatsapp_number, phone) = $2) OR ($3::text IS NOT NULL AND lower(email) = lower($3))) LIMIT 1`,
      [integration.tenantId, order.phone, order.email]
    );
    if (!customer.rowCount) {
      customer = await client.query(
        `INSERT INTO customers (tenant_id, name, email, phone, whatsapp_number, status)
         VALUES ($1, $2, $3, $4, $4, 'active') RETURNING id`,
        [integration.tenantId, order.customerName, order.email, order.phone]
      );
    } else {
      await client.query("UPDATE customers SET name = $1, email = COALESCE($2, email), phone = COALESCE($3, phone), whatsapp_number = COALESCE($3, whatsapp_number), updated_at = now() WHERE id = $4 AND tenant_id = $5", [order.customerName, order.email, order.phone, customer.rows[0].id, integration.tenantId]);
    }
    const customerId = customer.rows[0].id;
    const subscription = await client.query(
      `INSERT INTO subscriptions (tenant_id, customer_id, order_number, service_name, plan_name, start_date, end_date, status, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
       ON CONFLICT (tenant_id, order_number) DO UPDATE SET
         customer_id = EXCLUDED.customer_id, service_name = EXCLUDED.service_name,
         plan_name = EXCLUDED.plan_name, start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date, status = 'active', price = EXCLUDED.price, updated_at = now()
       RETURNING id`,
      [integration.tenantId, customerId, order.orderNumber, order.serviceName, order.planName, order.startDate, order.endDate, order.price]
    );
    await client.query(
      `INSERT INTO commerce_order_mappings (tenant_id, integration_id, external_order_id, customer_id, subscription_id, payload_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (integration_id, external_order_id) DO UPDATE SET
         customer_id = EXCLUDED.customer_id, subscription_id = EXCLUDED.subscription_id,
         payload_hash = EXCLUDED.payload_hash, synced_at = now(), updated_at = now()`,
      [integration.tenantId, integration.id, order.externalOrderId, customerId, subscription.rows[0].id, payloadHash]
    );
    await client.query("UPDATE commerce_integrations SET last_sync_at = now(), last_webhook_at = now(), last_error = NULL, updated_at = now() WHERE id = $1", [integration.id]);
    await client.query("INSERT INTO activity_logs (tenant_id, customer_id, type, title, metadata) VALUES ($1, $2, 'salla.order.synced', 'Salla order synchronized', $3::jsonb)", [integration.tenantId, customerId, JSON.stringify({ orderNumber: order.orderNumber, event })]);
  });
  return Response.json({ ok: true });
}
