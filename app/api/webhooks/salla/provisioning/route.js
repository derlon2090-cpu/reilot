import crypto from "node:crypto";
import { after } from "next/server";
import { verifySallaWebhook } from "../../../../../src/lib/salla.js";
import { query, transaction } from "../../../../../src/server/db.js";
import { provisionCustomerAccount } from "../../../../../src/server/provisioning.js";

function text(value) {
  return String(value ?? "").trim();
}

function first(...values) {
  return values.map(text).find(Boolean) || "";
}

function customerFrom(data) {
  const customer = data.customer || data.buyer || {};
  return {
    name: first(customer.name, [customer.first_name, customer.last_name].filter(Boolean).join(" "), data.customer_name),
    email: first(customer.email, data.customer_email, data.email)
  };
}

function itemIds(item) {
  return {
    itemId: first(item.id, item.item_id, item.order_item_id),
    variantId: first(item.variant_id, item.variant?.id, item.product?.variant_id),
    productId: first(item.product_id, item.product?.id, item.id),
    sku: first(item.sku, item.product?.sku),
    quantity: Math.max(1, Number(item.quantity || 1) || 1)
  };
}

function isPaid(data, payload) {
  const values = [data.payment_status, data.status?.slug, data.status?.name, data.status, payload.event, payload.event_type]
    .map((value) => text(value).toLowerCase()).filter(Boolean);
  return values.some((value) => /paid|payment[_ -]?completed|completed|complete|fulfilled|processing/.test(value));
}

export async function POST(req) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-salla-signature") || req.headers.get("x-salla-hmac-sha256") || "";
  if (!verifySallaWebhook(rawBody, signature)) return Response.json({ ok: false }, { status: 401 });
  let payload;
  try { payload = JSON.parse(rawBody); } catch { return Response.json({ ok: false, message: "Invalid JSON payload" }, { status: 400 }); }

  const data = payload?.data || payload?.order || payload;
  const storeId = first(payload.store?.id, payload.store_id, data.store_id, req.headers.get("x-salla-store-id"));
  const orderId = first(data.id, data.order_id, data.reference_id, payload.order_id);
  const eventType = first(payload.event, payload.event_type, req.headers.get("x-salla-event"), "order.updated");
  if (!storeId || !orderId) return Response.json({ ok: false, message: "Missing store or order identifier" }, { status: 400 });

  const eventHeader = first(req.headers.get("x-salla-event-id"), payload.id, payload.event_id);
  const idempotencyKey = eventHeader || crypto.createHash("sha256").update(`${storeId}:${orderId}:${eventType}:${text(data.updated_at || data.created_at)}:${text(data.status?.slug || data.status)}`).digest("hex");
  const customer = customerFrom(data);
  const items = Array.isArray(data.items) ? data.items : Array.isArray(data.products) ? data.products : [];
  if (!isPaid(data, payload)) return Response.json({ ok: true, queued: false, ignored: "payment_not_completed" }, { status: 200 });

  const jobs = await transaction(async (client) => {
    const event = await client.query(
      `INSERT INTO provisioning_webhook_events (salla_store_id,external_order_id,event_type,idempotency_key,payload,status)
       VALUES ($1,$2,$3,$4,$5::jsonb,'received')
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [storeId, orderId, eventType, idempotencyKey, rawBody]
    );
    if (!event.rowCount) return { duplicate: true, ids: [] };
    const ids = [];
    for (const rawItem of items) {
      const item = itemIds(rawItem);
      if (!item.variantId && !item.productId && !item.sku) continue;
      const mapping = await client.query(
        `SELECT id,internal_plan_id AS "planId",duration_value AS "durationValue",duration_unit AS "durationUnit",quantity_behavior AS "quantityBehavior",activation_trigger AS "activationTrigger"
           FROM provisioning_product_mappings
          WHERE salla_store_id=$1 AND is_active=true AND account_creation_enabled=true
            AND ((salla_variant_id IS NOT NULL AND salla_variant_id=$2)
              OR (salla_product_id IS NOT NULL AND salla_product_id=$3)
              OR (salla_sku IS NOT NULL AND salla_sku=$4))
          ORDER BY CASE WHEN salla_variant_id=$2 AND $2 <> '' THEN 1 WHEN salla_product_id=$3 AND $3 <> '' THEN 2 WHEN salla_sku=$4 AND $4 <> '' THEN 3 ELSE 4 END
          LIMIT 1`,
        [storeId, item.variantId, item.productId, item.sku]
      );
      if (!mapping.rowCount) continue;
      const match = mapping.rows[0];
      const job = await client.query(
        `INSERT INTO account_provisioning_jobs (external_order_id,external_order_item_id,customer_email,customer_name,mapping_id,plan_id,duration_value,duration_unit,quantity,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (external_order_id,external_order_item_id) DO NOTHING RETURNING id`,
        [orderId, item.itemId || `${orderId}:${item.productId}:${item.variantId}`, customer.email || null, customer.name || null, match.id, match.planId, match.durationValue, match.durationUnit, item.quantity, match.activationTrigger === "manual_approval" ? "pending" : "pending"]
      );
      if (job.rowCount) ids.push(job.rows[0].id);
    }
    await client.query("UPDATE provisioning_webhook_events SET status=$2,processed_at=now() WHERE id=$1", [event.rows[0].id, ids.length ? "queued" : "no_eligible_items"]);
    return { duplicate: false, ids };
  });

  if (!jobs.duplicate && jobs.ids.length) {
    after(async () => {
      for (const id of jobs.ids) {
        try { await provisionCustomerAccount(id); } catch (error) {
          await query("UPDATE account_provisioning_jobs SET status='failed',failure_code='PROVISIONING_FAILED',failure_message=$2,updated_at=now() WHERE id=$1", [id, String(error?.message || "provisioning_failed").slice(0, 500)]).catch(() => null);
        }
      }
    });
  }
  return Response.json({ ok: true, queued: !jobs.duplicate && jobs.ids.length > 0, duplicate: jobs.duplicate, jobCount: jobs.ids.length }, { status: 200 });
}
