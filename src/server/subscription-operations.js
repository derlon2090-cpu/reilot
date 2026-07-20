import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import {
  addSubscriptionDuration, findProductPlanMapping, normalizeSallaSubscriptionOrder,
  reminderIdempotencyKey, renewalBaseDate
} from "../lib/subscription-lifecycle.js";

function pgDate(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mappingRow(row) {
  return {
    ...row,
    isActive: row.is_active,
    sallaProductId: row.salla_product_id,
    sallaProductSku: row.salla_product_sku,
    sallaVariantId: row.salla_variant_id,
    startTrigger: row.start_trigger,
    specificOrderStatus: row.specific_order_status
  };
}

async function upsertOrderCustomer(client, tenantId, order) {
  const contact = order.customer;
  const byExternal = contact.externalId ? await client.query(
    "SELECT * FROM subscription_customers WHERE tenant_id = $1 AND salla_customer_id = $2 LIMIT 1 FOR UPDATE",
    [tenantId, contact.externalId]
  ) : { rows: [] };
  const byEmail = contact.email ? await client.query(
    "SELECT * FROM subscription_customers WHERE tenant_id = $1 AND email_normalized = $2 LIMIT 2 FOR UPDATE",
    [tenantId, contact.email]
  ) : { rows: [] };
  const byPhone = contact.phone ? await client.query(
    "SELECT * FROM subscription_customers WHERE tenant_id = $1 AND phone_e164 = $2 LIMIT 2 FOR UPDATE",
    [tenantId, contact.phone]
  ) : { rows: [] };
  const emailMatch = byEmail.rows[0];
  const phoneMatch = byPhone.rows[0];
  const conflict = emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id;
  let existing = byExternal.rows[0] || (!conflict ? emailMatch || phoneMatch : null);

  let legacy = contact.externalId ? await client.query(
    "SELECT id FROM customers WHERE tenant_id = $1 AND external_provider = 'salla' AND external_customer_id = $2 LIMIT 1",
    [tenantId, contact.externalId]
  ) : { rows: [] };
  if (!conflict && !legacy.rows[0] && contact.email) legacy = await client.query(
    "SELECT id FROM customers WHERE tenant_id = $1 AND lower(email) = $2 LIMIT 1", [tenantId, contact.email]
  );
  if (!conflict && !legacy.rows[0] && contact.phone) legacy = await client.query(
    "SELECT id FROM customers WHERE tenant_id = $1 AND COALESCE(whatsapp_number, phone) = $2 LIMIT 1", [tenantId, contact.phone]
  );
  if (!legacy.rows[0]) legacy = await client.query(
    `INSERT INTO customers (tenant_id, name, email, phone, whatsapp_number, status, external_provider, external_customer_id)
     VALUES ($1,$2,$3,$4,$4,'active','salla',$5) RETURNING id`,
    [tenantId, contact.name || "عميل سلة", contact.email, contact.phone, contact.externalId]
  );
  else if (!conflict) await client.query(
    `UPDATE customers SET name = COALESCE(NULLIF($1,''), name), email = COALESCE($2,email),
       phone = COALESCE($3,phone), whatsapp_number = COALESCE($3,whatsapp_number),
       external_provider = 'salla', external_customer_id = COALESCE($4,external_customer_id), updated_at = now()
     WHERE id = $5 AND tenant_id = $6`,
    [contact.name, contact.email, contact.phone, contact.externalId, legacy.rows[0].id, tenantId]
  );

  if (existing) {
    const updated = await client.query(
      `UPDATE subscription_customers SET legacy_customer_id = COALESCE(legacy_customer_id,$2),
         salla_customer_id = COALESCE($3,salla_customer_id), full_name = COALESCE(NULLIF($4,''),full_name),
         phone_e164 = CASE WHEN $8='needs_review' THEN phone_e164 ELSE COALESCE($5,phone_e164) END,
         phone_country_code = CASE WHEN $8='needs_review' THEN phone_country_code ELSE COALESCE($6,phone_country_code) END,
         email = CASE WHEN $8='needs_review' THEN email ELSE COALESCE($7,email) END,
         email_normalized = CASE WHEN $8='needs_review' THEN email_normalized ELSE COALESCE($7,email_normalized) END,
         email_eligible = CASE WHEN $8='needs_review' THEN email_eligible ELSE COALESCE($7,email_normalized) IS NOT NULL END,
         whatsapp_eligible = CASE WHEN $8='needs_review' THEN whatsapp_eligible ELSE COALESCE($5,phone_e164) IS NOT NULL END,
         customer_match_status = $8, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [existing.id, legacy.rows[0].id, contact.externalId, contact.name, contact.phone, contact.countryCode,
        contact.email, conflict ? "needs_review" : "matched"]
    );
    return updated.rows[0];
  }
  const inserted = await client.query(
    `INSERT INTO subscription_customers
       (tenant_id, legacy_customer_id, salla_customer_id, full_name, phone_e164, phone_country_code,
        email, email_normalized, email_eligible, whatsapp_eligible, customer_match_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10) RETURNING *`,
    [tenantId, legacy.rows[0].id, contact.externalId, contact.name || "عميل سلة", contact.phone,
      contact.countryCode, contact.email, Boolean(contact.email), Boolean(contact.phone), conflict ? "needs_review" : "matched"]
  );
  return inserted.rows[0];
}

async function scheduleSubscriptionReminders(client, subscription, plan, { enabled }) {
  await client.query(
    `UPDATE subscription_reminders SET status = 'cancelled', failure_reason = 'subscription_was_renewed', updated_at = now()
      WHERE subscription_id = $1 AND status IN ('scheduled','queued','processing','paused')`,
    [subscription.id]
  );
  if (!enabled || subscription.reminder_mode !== "automatic" || subscription.status !== "active") {
    await client.query("UPDATE customer_subscriptions SET next_reminder_at = NULL WHERE id = $1", [subscription.id]);
    return 0;
  }
  const configuredDays = Array.isArray(subscription.reminder_days)
    ? subscription.reminder_days
    : Array.isArray(plan.default_reminder_days) ? plan.default_reminder_days : [7, 1, 0];
  const uniqueDays = [...new Set(configuredDays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 90))];
  let created = 0;
  for (const day of uniqueDays) {
    const scheduled = new Date(subscription.expires_at);
    scheduled.setUTCDate(scheduled.getUTCDate() - day);
    scheduled.setUTCHours(6, 0, 0, 0);
    if (scheduled <= new Date()) continue;
    const type = day === 0 ? "on_expiry" : `before_${day}_days`;
    const key = reminderIdempotencyKey({ subscriptionId: subscription.id, type, scheduledFor: scheduled, channel: subscription.preferred_channel });
    const inserted = await client.query(
      `INSERT INTO subscription_reminders
         (tenant_id, subscription_id, reminder_type, original_expires_at, scheduled_for,
          channel, fallback_channel, status, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled',$8)
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [subscription.tenant_id, subscription.id, type, subscription.expires_at, scheduled,
        subscription.preferred_channel, subscription.fallback_channel, key]
    );
    created += inserted.rowCount;
  }
  await client.query(
    `UPDATE customer_subscriptions cs SET next_reminder_at = (
       SELECT min(sr.scheduled_for) FROM subscription_reminders sr
        WHERE sr.subscription_id = cs.id AND sr.status = 'scheduled') WHERE cs.id = $1`,
    [subscription.id]
  );
  return created;
}

async function recordUnmapped(client, tenantId, connectionId, order, item) {
  await client.query(
    `INSERT INTO unmapped_order_items
       (tenant_id, connection_id, salla_order_id, salla_order_item_id, order_number,
        salla_product_id, salla_variant_id, sku, product_name, quantity, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     ON CONFLICT (tenant_id, salla_order_item_id) DO UPDATE SET
       salla_product_id = EXCLUDED.salla_product_id, salla_variant_id = EXCLUDED.salla_variant_id,
       sku = EXCLUDED.sku, product_name = EXCLUDED.product_name, quantity = EXCLUDED.quantity,
       payload = EXCLUDED.payload, updated_at = now()`,
    [tenantId, connectionId, order.orderId, item.orderItemId, order.orderNumber, item.productId,
      item.variantId, item.sku, item.name, item.quantity, JSON.stringify(item)]
  );
}

export async function processSallaSubscriptionOrder({ tenantId, connectionId, payload, sendNotifications = true }) {
  const order = normalizeSallaSubscriptionOrder(payload);
  if (!order.orderId) throw new Error("salla_order_id_missing");
  return transaction(async (client) => {
    const customer = await upsertOrderCustomer(client, tenantId, order);
    await client.query(
      `INSERT INTO order_customer_snapshots
         (tenant_id, salla_order_id, salla_customer_id, customer_name, customer_email, customer_phone, source_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       ON CONFLICT (tenant_id, salla_order_id) DO UPDATE SET
         salla_customer_id = EXCLUDED.salla_customer_id, customer_name = EXCLUDED.customer_name,
         customer_email = EXCLUDED.customer_email, customer_phone = EXCLUDED.customer_phone,
         source_payload = EXCLUDED.source_payload, updated_at = now()`,
      [tenantId, order.orderId, order.customer.externalId, order.customer.name, order.customer.email,
        order.customer.phone, JSON.stringify(payload?.data || payload)]
    );
    await client.query(
      `INSERT INTO external_orders
         (tenant_id, connection_id, provider, external_order_id, order_number, customer_id,
          status, payment_status, total_amount, currency, raw_payload, ordered_at, customer_email, items)
       VALUES ($1,$2,'salla',$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb)
       ON CONFLICT (tenant_id, provider, external_order_id) DO UPDATE SET
         order_number = EXCLUDED.order_number, customer_id = EXCLUDED.customer_id,
         status = EXCLUDED.status, payment_status = EXCLUDED.payment_status,
         total_amount = EXCLUDED.total_amount, currency = EXCLUDED.currency,
         raw_payload = EXCLUDED.raw_payload, customer_email = EXCLUDED.customer_email,
         items = EXCLUDED.items, updated_at = now()`,
      [tenantId, connectionId, order.orderId, order.orderNumber, customer.legacy_customer_id,
        order.orderStatus, order.paymentStatus, order.amount, order.currency,
        JSON.stringify(payload?.data || payload), order.activatedAt, order.customer.email, JSON.stringify(order.items)]
    );
    const mappingResult = await client.query(
      `SELECT ppm.*, sp.name AS plan_name, sp.default_reminder_days, sp.expired_renewal_policy,
              sp.salla_product_url
         FROM product_plan_mappings ppm JOIN subscription_plans sp ON sp.id = ppm.internal_plan_id
        WHERE ppm.tenant_id = $1 AND ppm.is_active = true AND ppm.is_subscription_product = true`,
      [tenantId]
    );
    const mappings = mappingResult.rows.map(mappingRow);
    const result = { created: 0, renewed: 0, unmapped: 0, pendingActivation: 0, duplicates: 0, customerNeedsReview: customer.customer_match_status === "needs_review" };
    for (const item of order.items) {
      const mapping = findProductPlanMapping(item, mappings);
      if (!mapping) {
        await recordUnmapped(client, tenantId, connectionId, order, item);
        result.unmapped += 1;
        continue;
      }
      const trigger = mapping.start_trigger;
      const paid = ["paid", "completed", "success", "successful"].includes(order.paymentStatus);
      const completed = ["completed", "delivered", "fulfilled"].includes(order.orderStatus);
      const activated = trigger === "payment_completed" ? paid
        : trigger === "order_completed" ? completed
          : trigger === "specific_order_status" ? order.orderStatus === String(mapping.specific_order_status || "").toLowerCase()
            : false;
      if (!activated) {
        result.pendingActivation += 1;
        continue;
      }
      const copies = mapping.quantity_behavior === "create_multiple_subscriptions" ? item.quantity : 1;
      const durationMultiplier = mapping.quantity_behavior === "multiply_duration" ? item.quantity : 1;
      for (let copy = 0; copy < copies; copy++) {
        const sourceItemId = copies > 1 ? `${item.orderItemId}:${copy + 1}` : item.orderItemId;
        const existingSource = await client.query(
          `SELECT 1 FROM customer_subscriptions WHERE tenant_id = $1 AND salla_order_item_id = $2
           UNION ALL SELECT 1 FROM subscription_renewals WHERE tenant_id = $1 AND source_order_item_id = $2 LIMIT 1`,
          [tenantId, sourceItemId]
        );
        if (existingSource.rows[0]) { result.duplicates += 1; continue; }
        const prior = customer.customer_match_status === "needs_review" ? { rows: [] } : await client.query(
          `SELECT * FROM customer_subscriptions
            WHERE tenant_id = $1 AND customer_id = $2 AND plan_id = $3
              AND status IN ('active','expired','renewed')
            ORDER BY expires_at DESC LIMIT 1 FOR UPDATE`,
          [tenantId, customer.id, mapping.internal_plan_id]
        );
        const durationValue = Number(mapping.duration_value) * durationMultiplier;
        if (prior.rows[0]) {
          const previous = prior.rows[0];
          const base = renewalBaseDate({ expiresAt: previous.expires_at, activatedAt: order.activatedAt, expiredPolicy: mapping.expired_renewal_policy });
          const newExpiry = addSubscriptionDuration(base, durationValue, mapping.duration_unit);
          const renewal = await client.query(
            `INSERT INTO subscription_renewals
               (tenant_id, subscription_id, source, source_order_id, source_order_item_id,
                previous_expires_at, new_expires_at, duration_value, duration_unit, amount, currency)
             VALUES ($1,$2,'salla',$3,$4,$5,$6,$7,$8,$9,$10)
             ON CONFLICT (tenant_id, source_order_item_id) WHERE source_order_item_id IS NOT NULL DO NOTHING RETURNING id`,
            [tenantId, previous.id, order.orderId, sourceItemId, previous.expires_at, newExpiry,
              durationValue, mapping.duration_unit, item.amount, order.currency]
          );
          if (!renewal.rows[0]) { result.duplicates += 1; continue; }
          const updated = await client.query(
            `UPDATE customer_subscriptions SET expires_at = $2, status = 'active',
               last_renewed_at = now(), renewed_at = now(), duration_value=$5,duration_unit=$6,
               amount = $3, currency = $4, notification_status = 'ready', updated_at = now()
             WHERE id = $1 RETURNING *`,
            [previous.id, newExpiry, item.amount, order.currency,durationValue,mapping.duration_unit]
          );
          await scheduleSubscriptionReminders(client, updated.rows[0], mapping, { enabled: sendNotifications });
          await client.query("UPDATE renewal_tracking_links SET renewed_at = now() WHERE subscription_id = $1 AND renewed_at IS NULL", [previous.id]);
          result.renewed += 1;
        } else {
          const startsAt = new Date(order.activatedAt);
          const expiresAt = addSubscriptionDuration(startsAt, durationValue, mapping.duration_unit);
          const notificationStatus = !order.customer.email && !order.customer.phone ? "missing_contact" : "ready";
          const inserted = await client.query(
            `INSERT INTO customer_subscriptions
               (tenant_id, customer_id, plan_id, salla_order_id, salla_order_item_id,
                salla_product_id, salla_variant_id, order_number, service_name, status,
                starts_at, expires_at, duration_value,duration_unit,activated_at,activation_source,
                renewal_mode, reminder_mode, preferred_channel,
                fallback_channel, notification_status, source, amount, currency)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$11,$15,'manual_purchase','automatic',$16,$17,$18,'salla',$19,$20)
             ON CONFLICT (tenant_id, salla_order_item_id) DO NOTHING RETURNING *`,
            [tenantId, customer.id, mapping.internal_plan_id, order.orderId, sourceItemId,
              item.productId || mapping.salla_product_id, item.variantId, order.orderNumber, item.name || mapping.plan_name,
              customer.customer_match_status === "needs_review" ? "needs_review" : "active", startsAt, expiresAt,durationValue,mapping.duration_unit,mapping.start_trigger,
              order.customer.phone ? "whatsapp" : "email", order.customer.phone && order.customer.email ? "email" : null,
              notificationStatus, item.amount, order.currency]
          );
          if (!inserted.rows[0]) { result.duplicates += 1; continue; }
          await scheduleSubscriptionReminders(client, inserted.rows[0], mapping, { enabled: sendNotifications });
          result.created += 1;
        }
      }
    }
    await client.query(
      `INSERT INTO app_sync_logs (tenant_id, connection_id, provider, event_type, external_id, status, message)
       VALUES ($1,$2,'salla','subscription.order.processed',$3,'success',$4)`,
      [tenantId, connectionId, order.orderId,
        `اشتراكات جديدة: ${result.created}، تجديدات: ${result.renewed}، تحتاج ربطًا: ${result.unmapped}`]
    );
    return result;
  });
}

export async function listSubscriptionOperations(tenantId, options = {}) {
  const limit = Math.min(100, Math.max(1, Number(options.limit || 20)));
  const page = Math.max(1, Number(options.page || 1));
  const values = [tenantId];
  const where = ["cs.tenant_id = $1"];
  const add = (sql, value) => { values.push(value); where.push(sql.replace("?", `$${values.length}`)); };
  if (options.search) {
    values.push(options.search);
    const placeholder = `$${values.length}`;
    where.push(`(sc.full_name ILIKE '%' || ${placeholder} || '%' OR cs.order_number ILIKE '%' || ${placeholder} || '%' OR cs.id::text ILIKE '%' || ${placeholder} || '%')`);
  }
  if (options.status) add("cs.status = ?", options.status);
  if (options.planId) add("cs.plan_id = ?", options.planId);
  if (options.channel) add("cs.preferred_channel = ?", options.channel);
  if (options.renewalWindow) add("cs.expires_at <= now() + (?::int * interval '1 day') AND cs.expires_at >= now()", Number(options.renewalWindow));
  if (options.source) add("cs.source = ?", options.source);
  if (options.dateFrom) add("cs.expires_at >= ?::date", options.dateFrom);
  if (options.dateTo) add("cs.expires_at < (?::date + interval '1 day')", options.dateTo);
  if (options.reminderStatus) add("EXISTS (SELECT 1 FROM subscription_reminders sr WHERE sr.subscription_id=cs.id AND sr.status = ?)", options.reminderStatus);
  const clause = where.join(" AND ");
  values.push(limit, (page - 1) * limit);
  const rows = await query(
    `SELECT cs.id, cs.order_number AS "orderNumber", cs.service_name AS "serviceName",
            sp.name AS "planName", cs.plan_id AS "planId", cs.starts_at AS "startDate",
            cs.expires_at AS "endDate", cs.status, cs.amount AS price, cs.currency,
            cs.preferred_channel AS "reminderChannel", cs.fallback_channel AS "fallbackChannel",
            cs.reminder_mode AS "reminderMode", COALESCE((cs.reminder_days->>0)::int,7) AS "reminderDaysBefore",
            cs.next_reminder_at AS "nextReminderAt",
            cs.last_reminder_sent_at AS "lastReminderSentAt", cs.last_reminder_channel AS "lastReminderChannel",
            cs.notification_status AS "notificationStatus", cs.source,
            sc.id AS "customerId", sc.full_name AS "customerName", sc.email,
            sc.phone_e164 AS "whatsappNumber", sc.email_eligible AS "emailEligible",
            sc.whatsapp_eligible AS "whatsappEligible", sc.customer_match_status AS "customerMatchStatus",
            CASE WHEN cs.last_reminder_sent_at > now() - interval '72 hours' THEN true ELSE false END AS "showSentBadge",
            mq.status AS "lastMessageStatus", mq.last_error AS "lastMessageError", mq.sent_at AS "lastMessageSentAt"
       FROM customer_subscriptions cs
       JOIN subscription_customers sc ON sc.id = cs.customer_id
       JOIN subscription_plans sp ON sp.id = cs.plan_id
       LEFT JOIN LATERAL (SELECT status, last_error, sent_at FROM message_queue
         WHERE customer_subscription_id = cs.id ORDER BY created_at DESC LIMIT 1) mq ON true
      WHERE ${clause}
      ORDER BY cs.expires_at, cs.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  const countValues = values.slice(0, -2);
  const count = await query(`SELECT count(*)::int AS total FROM customer_subscriptions cs JOIN subscription_customers sc ON sc.id = cs.customer_id WHERE ${clause}`, countValues);
  return { items: rows.rows, page, limit, total: count.rows[0]?.total || 0 };
}

export async function subscriptionOperationsSummary(tenantId) {
  const [summary, upcoming, plans, logs, connection, unmapped, reminderPerformance] = await Promise.all([
    query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE status='active')::int AS active,
      count(*) FILTER (WHERE status='active' AND expires_at BETWEEN now() AND now()+interval '7 days')::int AS "upcoming7",
      COALESCE(sum(amount) FILTER (WHERE status='active'),0) AS "activeValue"
      FROM customer_subscriptions WHERE tenant_id=$1`, [tenantId]),
    query(`SELECT cs.id, sc.full_name AS "customerName", sp.name AS "planName", cs.expires_at AS "endDate"
      FROM customer_subscriptions cs JOIN subscription_customers sc ON sc.id=cs.customer_id
      JOIN subscription_plans sp ON sp.id=cs.plan_id
      WHERE cs.tenant_id=$1 AND cs.status='active' AND cs.expires_at>=now()
      ORDER BY cs.expires_at LIMIT 5`, [tenantId]),
    query("SELECT id,name FROM subscription_plans WHERE tenant_id=$1 AND is_active=true ORDER BY name", [tenantId]),
    query(`SELECT mq.id, mq.channel_type AS channel, mq.status, mq.sent_at AS "sentAt", mq.last_error AS "errorMessage",
      sc.full_name AS "customerName", cs.service_name AS "serviceName"
      FROM message_queue mq LEFT JOIN customer_subscriptions cs ON cs.id=mq.customer_subscription_id
      LEFT JOIN subscription_customers sc ON sc.id=cs.customer_id
      WHERE mq.tenant_id=$1 AND mq.message_type='renewal_reminder' ORDER BY mq.created_at DESC LIMIT 20`, [tenantId]),
    query("SELECT status FROM app_connections WHERE tenant_id=$1 AND provider='salla' LIMIT 1", [tenantId]),
    query("SELECT count(*)::int AS total FROM unmapped_order_items WHERE tenant_id=$1 AND status='needs_mapping'", [tenantId]),
    query(`SELECT
      (SELECT count(*)::int FROM subscription_reminders WHERE tenant_id=$1 AND status IN ('scheduled','queued','processing')) AS scheduled,
      (SELECT count(*)::int FROM subscription_reminders WHERE tenant_id=$1 AND status IN ('sent','delivered')) AS successful,
      (SELECT count(*)::int FROM subscription_reminders WHERE tenant_id=$1 AND status='failed') AS failed,
      (SELECT count(*)::int FROM renewal_tracking_links WHERE tenant_id=$1 AND opened_at IS NOT NULL) AS opened,
      (SELECT count(*)::int FROM renewal_tracking_links WHERE tenant_id=$1 AND clicked_at IS NOT NULL) AS clicked,
      (SELECT count(*)::int FROM renewal_tracking_links WHERE tenant_id=$1 AND renewed_at IS NOT NULL) AS renewed,
      (SELECT channel FROM notification_logs WHERE tenant_id=$1 AND status IN ('sent','delivered')
        GROUP BY channel ORDER BY count(*) DESC LIMIT 1) AS "bestChannel"`, [tenantId])
  ]);
  return { summary: summary.rows[0], upcoming: upcoming.rows, plans: plans.rows, sendLog: logs.rows,
    sallaConnected: connection.rows[0]?.status === "connected", unmappedCount: unmapped.rows[0]?.total || 0,
    reminderPerformance: { ...reminderPerformance.rows[0], conversionRate: Number(reminderPerformance.rows[0]?.opened || 0) > 0
      ? Math.round(Number(reminderPerformance.rows[0]?.renewed || 0) / Number(reminderPerformance.rows[0]?.opened) * 100) : null } };
}

export function rescheduleSubscriptionReminders(tenantId, subscriptionId, enabled = true) {
  return transaction(async (client) => {
    const result = await client.query(
      `SELECT cs.*,sp.default_reminder_days FROM customer_subscriptions cs
       JOIN subscription_plans sp ON sp.id=cs.plan_id WHERE cs.id=$1 AND cs.tenant_id=$2 FOR UPDATE OF cs`,
      [subscriptionId, tenantId]
    );
    if (!result.rows[0]) return 0;
    return scheduleSubscriptionReminders(client, result.rows[0], result.rows[0], { enabled });
  });
}

export function webhookExternalId(payload) {
  const supplied = payload?.event_id || payload?.webhook_id || payload?.data?.event_id || payload?.data?.webhook_id;
  if (supplied) return String(supplied);
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
