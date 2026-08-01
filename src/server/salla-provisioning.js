import crypto from "node:crypto";
import { isSallaPaymentCompleted } from "../lib/salla-payment.js";
import { normalizeSubscriptionPhone } from "../lib/subscription-lifecycle.js";
import { query, transaction } from "./db.js";
import { provisionCustomerAccount } from "./provisioning.js";

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
    email: first(customer.email, data.customer_email, data.email).toLowerCase(),
    phone: normalizeSubscriptionPhone(
      first(customer.mobile, customer.phone, data.receiver?.phone, data.customer_phone),
      first(customer.country_code, data.receiver?.country_code, "SA")
    )
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

export function normalizeProvisioningPurchase(payload = {}, metadata = {}) {
  const data = payload?.data || payload?.order || payload;
  const merchant = payload?.merchant;
  const dataMerchant = data?.merchant;
  const storeId = first(
    typeof merchant === "object" ? merchant?.id : merchant,
    payload.store?.id,
    payload.store_id,
    payload.merchant_id,
    typeof dataMerchant === "object" ? dataMerchant?.id : dataMerchant,
    data.store_id,
    metadata.storeId
  );
  const orderId = first(data.id, data.order_id, data.reference_id, payload.order_id);
  const eventType = first(payload.event, payload.type, payload.event_type, metadata.eventType, "order.updated");
  const eventHeader = first(metadata.eventId, payload.id, payload.event_id);
  const idempotencyKey = eventHeader || crypto.createHash("sha256")
    .update(`${storeId}:${orderId}:${eventType}:${text(data.updated_at || data.created_at)}:${text(data.status?.slug || data.status)}`)
    .digest("hex");
  return {
    data,
    storeId,
    orderId,
    eventType,
    idempotencyKey,
    customer: customerFrom(data),
    items: (Array.isArray(data.items) ? data.items : Array.isArray(data.products) ? data.products : []).map(itemIds),
    paymentCompleted: isSallaPaymentCompleted(data, payload)
  };
}

export async function queueSallaProvisioningJobs(payload, metadata = {}) {
  const purchase = normalizeProvisioningPurchase(payload, metadata);
  if (!purchase.storeId || !purchase.orderId) return { ok: false, reason: "missing_order_identity", ids: [] };
  if (!purchase.paymentCompleted) return { ok: true, queued: false, ignored: "payment_not_completed", ids: [] };

  return transaction(async (client) => {
    const event = await client.query(
      `INSERT INTO provisioning_webhook_events (salla_store_id,external_order_id,event_type,idempotency_key,payload,status)
       VALUES ($1,$2,$3,$4,$5::jsonb,'received')
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [purchase.storeId, purchase.orderId, purchase.eventType, purchase.idempotencyKey, JSON.stringify(payload)]
    );
    if (!event.rowCount) return { ok: true, duplicate: true, queued: false, ids: [] };

    const ids = [];
    for (const item of purchase.items) {
      if (!item.variantId && !item.productId && !item.sku) continue;
      const mapping = await client.query(
        `SELECT id,internal_plan_id AS "planId",duration_value AS "durationValue",duration_unit AS "durationUnit",
                quantity_behavior AS "quantityBehavior",activation_trigger AS "activationTrigger"
           FROM provisioning_product_mappings
          WHERE salla_store_id=$1 AND is_active=true AND account_creation_enabled=true
            AND ((salla_variant_id IS NOT NULL AND salla_variant_id=$2)
              OR (salla_product_id IS NOT NULL AND salla_product_id=$3)
              OR (salla_sku IS NOT NULL AND salla_sku=$4))
          ORDER BY CASE WHEN salla_variant_id=$2 AND $2 <> '' THEN 1 WHEN salla_product_id=$3 AND $3 <> '' THEN 2 WHEN salla_sku=$4 AND $4 <> '' THEN 3 ELSE 4 END
          LIMIT 1`,
        [purchase.storeId, item.variantId, item.productId, item.sku]
      );
      if (!mapping.rowCount) continue;
      const match = mapping.rows[0];
      if (match.activationTrigger && match.activationTrigger !== "payment_completed") continue;
      const job = await client.query(
        `INSERT INTO account_provisioning_jobs
           (external_order_id,external_order_item_id,customer_email,customer_name,customer_phone_e164,
            mapping_id,plan_id,duration_value,duration_unit,quantity,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
         ON CONFLICT (external_order_id,external_order_item_id) DO NOTHING RETURNING id`,
        [purchase.orderId, item.itemId || `${purchase.orderId}:${item.productId}:${item.variantId}`,
          purchase.customer.email || null, purchase.customer.name || null, purchase.customer.phone || null,
          match.id, match.planId, match.durationValue, match.durationUnit, item.quantity]
      );
      if (job.rowCount) ids.push(job.rows[0].id);
    }
    await client.query(
      "UPDATE provisioning_webhook_events SET status=$2,processed_at=now() WHERE id=$1",
      [event.rows[0].id, ids.length ? "queued" : "no_eligible_items"]
    );
    return { ok: true, duplicate: false, queued: ids.length > 0, ids };
  });
}

export async function processProvisioningJobIds(ids = []) {
  const completed = [];
  const failed = [];
  for (const id of ids) {
    try {
      await provisionCustomerAccount(id);
      completed.push(id);
    } catch (error) {
      failed.push(id);
      await query(
        "UPDATE account_provisioning_jobs SET status='failed',failure_code='PROVISIONING_FAILED',failure_message=$2,updated_at=now() WHERE id=$1",
        [id, String(error?.message || "provisioning_failed").slice(0, 500)]
      ).catch(() => null);
    }
  }
  return { completed, failed };
}

export async function processSallaProvisioningPurchase(payload, metadata = {}) {
  const queued = await queueSallaProvisioningJobs(payload, metadata);
  const processed = await processProvisioningJobIds(queued.ids || []);
  return { ...queued, ...processed };
}
