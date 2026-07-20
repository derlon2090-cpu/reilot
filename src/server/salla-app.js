import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { decryptSecret, encryptSecret } from "../lib/encryption.js";
import { normalizeOptionalEmail, validateOptionalEmail } from "../lib/customerValidation.js";
import { normalizeSallaOrder, normalizeSallaSubscriptionRules, resolveSallaSubscriptionRule } from "../lib/salla.js";
import { createOrderInfoLink, ensureOrderLinkProfile, saveOrderLinkProfile } from "./order-links.js";
import { enqueueMessage } from "./message-queue.js";
import { createInAppNotification } from "./in-app-notifications.js";
import { recordOperationalIssue } from "./operations.js";
import { PLAN_MESSAGE_LIMIT_REACHED } from "../lib/billing/message-quota.js";
import { processSallaSubscriptionOrder, webhookExternalId } from "./subscription-operations.js";

const DEFAULT_VISIBLE_FIELDS = {
  customerName: true, planName: true, startDate: true, endDate: true,
  remainingDays: true, status: true, storeName: true, additionalNotes: true
};

export function sallaConfigured() {
  return Boolean(process.env.SALLA_CLIENT_ID && process.env.SALLA_CLIENT_SECRET && process.env.ENCRYPTION_KEY);
}

export function sallaRedirectUri(origin) {
  return process.env.SALLA_REDIRECT_URI || `${origin}/api/apps/salla/callback`;
}

export async function createOauthState(tenantId) {
  const state = crypto.randomBytes(24).toString("hex");
  await query(
    `INSERT INTO oauth_states (tenant_id, provider, state, expires_at)
     VALUES ($1, 'salla', $2, now() + interval '10 minutes')`,
    [tenantId, state]
  );
  return state;
}

export async function consumeOauthState(state) {
  return transaction(async (client) => {
    const result = await client.query(
      `SELECT id, tenant_id AS "tenantId" FROM oauth_states
        WHERE provider = 'salla' AND state = $1 AND used_at IS NULL AND expires_at > now()
        FOR UPDATE`, [state]
    );
    if (!result.rows[0]) return null;
    await client.query("UPDATE oauth_states SET used_at = now() WHERE id = $1", [result.rows[0].id]);
    return result.rows[0];
  });
}

export async function ensureSallaTemplate(tenantId, storeName = "متجر سلة") {
  const existing = await query(
    `SELECT id FROM order_info_templates
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY is_default DESC, created_at ASC LIMIT 1`, [tenantId]
  );
  if (existing.rows[0]) return existing.rows[0].id;
  await ensureOrderLinkProfile(tenantId);
  const result = await query(
    `INSERT INTO order_info_templates
      (tenant_id, name, style, theme_color, store_name, header_text, footer_text,
       additional_notes, visible_fields, is_default, is_active)
     VALUES ($1, 'قالب سلة الافتراضي', 'classic', '#22C55E', $2,
       'شكرًا لاختيارك خدماتنا', 'مدعوم من Renvix', $3::jsonb, $4::jsonb, true, true)
     RETURNING id`,
    [tenantId, storeName, JSON.stringify([
      "احتفظ بهذا الرابط للرجوع إلى معلومات طلبك لاحقًا.",
      "يمكنك التواصل مع المتجر في حال وجود أي استفسار."
    ]), JSON.stringify(DEFAULT_VISIBLE_FIELDS)]
  );
  return result.rows[0].id;
}

export async function upsertSallaConnection({ tenantId, accessToken, refreshToken, expiresIn, scopes, merchant }) {
  const storeId = String(merchant.id || merchant.merchant_id || "").trim();
  if (!storeId) throw new Error("Salla merchant id is missing");
  const storeName = String(merchant.name || merchant.store_name || "متجر سلة").trim();
  const storeDomain = merchant.domain || merchant.store_domain || null;
  const tokenExpiresAt = expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000) : null;
  return transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO app_connections
        (tenant_id, provider, provider_store_id, provider_store_name, provider_store_domain,
         status, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes, last_error)
       VALUES ($1, 'salla', $2, $3, $4, 'connected', $5, $6, $7, $8::jsonb, NULL)
       ON CONFLICT (tenant_id, provider) DO UPDATE SET
         provider_store_id = EXCLUDED.provider_store_id,
         provider_store_name = EXCLUDED.provider_store_name,
         provider_store_domain = EXCLUDED.provider_store_domain,
         status = 'connected', access_token_encrypted = EXCLUDED.access_token_encrypted,
         refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
         token_expires_at = EXCLUDED.token_expires_at, scopes = EXCLUDED.scopes,
         last_error = NULL, updated_at = now()
       RETURNING id`,
      [tenantId, storeId, storeName, storeDomain,
        encryptSecret(accessToken, process.env.ENCRYPTION_KEY),
        refreshToken ? encryptSecret(refreshToken, process.env.ENCRYPTION_KEY) : null,
        tokenExpiresAt, JSON.stringify(Array.isArray(scopes) ? scopes : String(scopes || "").split(/\s+/).filter(Boolean))]
    );
    const templateId = await ensureSallaTemplate(tenantId, storeName);
    await client.query(
      `INSERT INTO salla_connection_settings
        (tenant_id, connection_id, default_template_id, store_display_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, connection_id) DO UPDATE SET
         store_display_name = COALESCE(salla_connection_settings.store_display_name, EXCLUDED.store_display_name),
         default_template_id = COALESCE(salla_connection_settings.default_template_id, EXCLUDED.default_template_id),
         updated_at = now()`, [tenantId, result.rows[0].id, templateId, storeName]
    );
    return result.rows[0].id;
  });
}

export async function registerSallaOperationalWebhooks(accessToken, origin) {
  const base = (process.env.SALLA_API_BASE_URL || "https://api.salla.dev/admin/v2").replace(/\/$/, "");
  const headers = { authorization: `Bearer ${accessToken}`, accept: "application/json", "content-type": "application/json" };
  const listResponse = await fetch(`${base}/webhooks/events`, { headers });
  const listPayload = await listResponse.json().catch(() => ({}));
  if (!listResponse.ok) throw new Error(`Salla webhook events request failed (${listResponse.status})`);
  const eventRows = Array.isArray(listPayload.data) ? listPayload.data : Array.isArray(listPayload.data?.data) ? listPayload.data.data : [];
  const available = new Set(eventRows.map((item) => String(item.event || item.name || item)).filter(Boolean));
  const desired = [
    "order.created", "order.updated", "order.payment.updated", "order.status.updated",
    "order.cancelled", "order.refunded", "order.deleted", "order.products.updated",
    "customer.created", "customer.updated"
  ].filter((event) => available.size === 0 || available.has(event));
  const callbackUrl = `${String(origin).replace(/\/$/, "")}/api/webhooks/salla`;
  for (const event of desired) {
    const response = await fetch(`${base}/webhooks/subscribe`, {
      method: "POST", headers,
      body: JSON.stringify({ name: `Renvix ${event}`, event, url: callbackUrl, version: 2 })
    });
    if (!response.ok) throw new Error(`Salla webhook registration failed for ${event} (${response.status})`);
  }
  return { registered: desired.length, events: desired };
}

export async function getSallaDashboard(tenantId) {
  const [connection, templates, logs, counts] = await Promise.all([
    query(`SELECT ac.id, ac.status, ac.provider_store_name AS "storeName", ac.provider_store_domain AS "storeDomain",
                  ac.last_sync_at AS "lastSyncAt", ac.last_error AS "lastError",
                  scs.auto_sync_customers AS "autoSyncCustomers", scs.auto_sync_orders AS "autoSyncOrders",
                  scs.auto_create_subscriptions AS "autoCreateSubscriptions",
                  scs.auto_create_order_links AS "autoCreateOrderLinks",
                  scs.default_template_id AS "defaultTemplateId", scs.default_template_style AS "defaultTemplateStyle",
                  scs.default_theme_color AS "defaultThemeColor", scs.store_display_name AS "storeDisplayName",
                  scs.order_link_slug AS "orderLinkSlug", scs.sync_paid_orders_only AS "syncPaidOrdersOnly",
                  scs.sync_completed_orders_only AS "syncCompletedOrdersOnly",
                  scs.default_subscription_duration_days AS "defaultSubscriptionDurationDays",
                  scs.subscription_rules AS "subscriptionRules", scs.sync_order_status AS "syncOrderStatus",
                  scs.link_creation_mode AS "linkCreationMode",
                  scs.auto_detect_product_duration AS "autoDetectProductDuration",
                  scs.notify_customer_after_link_created AS "notifyCustomerAfterLinkCreated",
                  scs.send_method AS "sendMethod"
             FROM app_connections ac
             LEFT JOIN salla_connection_settings scs ON scs.connection_id = ac.id AND scs.tenant_id = ac.tenant_id
            WHERE ac.tenant_id = $1 AND ac.provider = 'salla' LIMIT 1`, [tenantId]),
    query(`SELECT id, name, style, theme_color AS "themeColor", store_name AS "storeName", is_default AS "isDefault"
             FROM order_info_templates WHERE tenant_id = $1 AND is_active = true ORDER BY is_default DESC, updated_at DESC`, [tenantId]),
    query(`SELECT id, event_type AS "eventType", status, message, created_at AS "createdAt"
             FROM app_sync_logs WHERE tenant_id = $1 AND provider = 'salla' ORDER BY created_at DESC LIMIT 50`, [tenantId]),
    query(`SELECT
      (SELECT count(*)::int FROM app_connections WHERE tenant_id = $1 AND status = 'connected') AS "connectedApps",
      (SELECT count(*)::int FROM external_orders WHERE tenant_id = $1 AND provider = 'salla') AS "syncedOrders"`, [tenantId])
  ]);
  const row = connection.rows[0] || null;
  return {
    configured: sallaConfigured(),
    stats: { availableApps: 1, connectedApps: counts.rows[0]?.connectedApps || 0, syncedOrders: counts.rows[0]?.syncedOrders || 0, lastSyncAt: row?.lastSyncAt || null },
    connection: row,
    templates: templates.rows,
    logs: logs.rows
  };
}

export async function saveSallaSettings(tenantId, body) {
  const connection = await query("SELECT id FROM app_connections WHERE tenant_id = $1 AND provider = 'salla' LIMIT 1", [tenantId]);
  if (!connection.rows[0]) return { ok: false, reason: "not_connected" };
  const rules = normalizeSallaSubscriptionRules(body.subscriptionRules || []);
  const duration = Math.max(1, Math.min(3650, Number(body.defaultSubscriptionDurationDays || 30)));
  const colors = new Set(["#2563EB", "#06B6D4", "#8B5CF6", "#22C55E", "#F97316", "#EF4444", "#64748B", "#0F172A"]);
  const color = colors.has(body.defaultThemeColor) ? body.defaultThemeColor : "#22C55E";
  const style = ["classic", "modern", "professional", "minimal", "premium", "colorful"].includes(body.defaultTemplateStyle) ? body.defaultTemplateStyle : "classic";
  const sendMethod = ["manual", "whatsapp", "email", "copy_only"].includes(body.sendMethod) ? body.sendMethod : "manual";
  const templateId = body.defaultTemplateId || await ensureSallaTemplate(tenantId, body.storeDisplayName || "متجر سلة");
  const profile = await ensureOrderLinkProfile(tenantId);
  const profileResult = await saveOrderLinkProfile({
    tenantId,
    storeName: String(body.storeDisplayName || profile.storeName || "متجر سلة").trim(),
    slug: String(body.orderLinkSlug || profile.slug || "").trim().toLowerCase(),
    logoUrl: profile.logoUrl,
    defaultTemplateStyle: style,
    defaultThemeColor: color,
    isActive: true
  });
  if (!profileResult.ok) return { ok: false, reason: profileResult.reason };
  await query(
    `INSERT INTO salla_connection_settings (tenant_id, connection_id, default_template_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, connection_id) DO UPDATE SET
       auto_sync_customers = $4, auto_sync_orders = $5, auto_create_subscriptions = $6,
       auto_create_order_links = $7, default_template_id = $3, default_template_style = $8,
       default_theme_color = $9, store_display_name = $10, order_link_slug = $11,
       sync_paid_orders_only = $12, sync_completed_orders_only = $13,
       default_subscription_duration_days = $14, subscription_rules = $15::jsonb,
       sync_order_status = $16, notify_customer_after_link_created = $17,
       send_method = $18, link_creation_mode = $19,
       auto_detect_product_duration = $20, updated_at = now()`,
    [tenantId, connection.rows[0].id, templateId,
      body.autoSyncCustomers !== false, body.autoSyncOrders !== false,
      body.autoCreateSubscriptions !== false, body.autoCreateOrderLinks !== false,
      style, color, String(body.storeDisplayName || "").trim().slice(0, 120) || null,
      profileResult.profile.slug,
      body.syncPaidOrdersOnly !== false, Boolean(body.syncCompletedOrdersOnly), duration,
      JSON.stringify(rules), body.syncOrderStatus !== false,
      Boolean(body.notifyCustomerAfterLinkCreated), sendMethod,
      body.linkCreationMode === "manual" ? "manual" : "automatic",
      body.autoDetectProductDuration !== false]
  );
  await query(`UPDATE order_info_templates SET style = $3, theme_color = $4,
                store_name = COALESCE(NULLIF($5, ''), store_name), updated_at = now()
               WHERE id = $1 AND tenant_id = $2`, [templateId, tenantId, style, color, body.storeDisplayName || ""]);
  return { ok: true };
}

function eventStoreId(payload) {
  const merchant = payload?.merchant;
  return String(
    (merchant && typeof merchant === "object" ? merchant.id : merchant)
      || payload?.merchant_id
      || payload?.data?.merchant?.id
      || payload?.data?.store?.id
      || ""
  ).trim();
}

function eventCustomerId(payload) {
  const data = payload?.data || {};
  return String(data.customer?.id || data.id || "").trim();
}

async function logSync(client, { tenantId, connectionId, event, externalId, status, message }) {
  await client.query(`INSERT INTO app_sync_logs (tenant_id, connection_id, provider, event_type, external_id, status, message)
    VALUES ($1, $2, 'salla', $3, $4, $5, $6)`, [tenantId, connectionId, event, externalId || null, status, message]);
}

function findProductMapping(items, mappings) {
  for (const item of items) {
    const productId = String(item.externalProductId || "").trim();
    const sku = String(item.sku || "").trim().toLowerCase();
    const name = String(item.name || "").trim().toLowerCase();
    const match = mappings.find((mapping) =>
      (productId && mapping.external_product_id === productId)
      || (sku && String(mapping.product_sku || "").trim().toLowerCase() === sku)
      || (name && String(mapping.product_name || "").trim().toLowerCase() === name)
    );
    if (match) return match;
  }
  return null;
}

export async function processSallaEvent(payload, { sendNotifications = true } = {}) {
  const event = String(payload.event || payload.type || "");
  const storeId = eventStoreId(payload);
  if (!storeId) return { ok: true, skipped: true };
  const connectionResult = await query(
    `SELECT ac.id, ac.tenant_id AS "tenantId", ac.status,
            ac.provider_store_name, ac.access_token_encrypted, ac.refresh_token_encrypted, ac.token_expires_at,
            scs.* FROM app_connections ac
       LEFT JOIN salla_connection_settings scs ON scs.connection_id = ac.id AND scs.tenant_id = ac.tenant_id
      WHERE ac.provider = 'salla' AND ac.provider_store_id = $1 LIMIT 1`, [storeId]
  );
  const connection = connectionResult.rows[0];
  if (!connection || connection.status !== "connected") return { ok: true, skipped: true };
  if (event === "app.uninstalled") {
    await query("UPDATE app_connections SET status = 'disconnected', updated_at = now() WHERE id = $1", [connection.id]);
    return { ok: true };
  }
  const isCustomer = event === "customer.created" || event === "customer.updated";
  const isOrder = ["order.created", "order.updated", "order.payment.updated", "order.status.updated", "order.cancelled", "order.refunded", "order.deleted", "order.products.updated"].includes(event);
  if (!isCustomer && !isOrder) return { ok: true, skipped: true };
  if (isCustomer && !connection.auto_sync_customers) {
    await query(`INSERT INTO app_sync_logs
      (tenant_id, connection_id, provider, event_type, external_id, status, message)
      VALUES ($1, $2, 'salla', $3, $4, 'skipped', 'مزامنة العملاء التلقائية غير مفعلة')`,
      [connection.tenantId, connection.id, event, eventCustomerId(payload) || null]);
    return { ok: true, skipped: true };
  }
  if (isOrder && !connection.auto_sync_orders) {
    await query(`INSERT INTO app_sync_logs
      (tenant_id, connection_id, provider, event_type, external_id, status, message)
      VALUES ($1, $2, 'salla', $3, $4, 'skipped', 'مزامنة الطلبات التلقائية غير مفعلة')`,
      [connection.tenantId, connection.id, event, String((payload.data || payload).id || "") || null]);
    return { ok: true, skipped: true };
  }

  if (isOrder) {
    let orderPayload = payload;
    const rawOrder = payload?.data || payload || {};
    const orderId = String(rawOrder.id || rawOrder.order_id || rawOrder.reference_id || "").trim();
    if (orderId && (!Array.isArray(rawOrder.items) || rawOrder.items.length === 0)) {
      try {
        const token = await getSallaAccessToken(connection);
        const base = (process.env.SALLA_API_BASE_URL || "https://api.salla.dev/admin/v2").replace(/\/$/, "");
        const response = await fetch(`${base}/orders/${encodeURIComponent(orderId)}`, {
          headers: { authorization: `Bearer ${token}`, accept: "application/json" }
        });
        const details = await response.json().catch(() => ({}));
        if (response.ok && details?.data) orderPayload = { ...payload, data: details.data };
      } catch {
        // The verified webhook payload remains the source when Order Details is temporarily unavailable.
      }
    }
    return processSallaSubscriptionOrder({
      tenantId: connection.tenantId,
      connectionId: connection.id,
      payload: orderPayload,
      sendNotifications
    });
  }

  const initialOrder = normalizeSallaOrder(payload, connection.default_subscription_duration_days || 30);
  const mappings = await query(
    `SELECT external_product_id, product_name, product_sku, plan_name, duration_days
       FROM salla_product_mappings
      WHERE tenant_id = $1 AND connection_id = $2 AND is_active = true`,
    [connection.tenantId, connection.id]
  );
  const productMapping = findProductMapping(initialOrder.items, mappings.rows);
  const detected = connection.auto_detect_product_duration === false
    ? { rule: null, durationDays: Number(connection.default_subscription_duration_days || 30), source: "fallback", confidence: 0.35 }
    : resolveSallaSubscriptionRule(payload, connection.subscription_rules || [], connection.default_subscription_duration_days || 30);
  const durationMatch = productMapping
    ? { rule: { name: productMapping.plan_name }, durationDays: Number(productMapping.duration_days), source: "product_mapping", confidence: 1 }
    : detected;
  const order = normalizeSallaOrder(payload, durationMatch.durationDays);
  const raw = payload.data || payload;
  const rawStatus = String(raw.status?.slug || raw.status || "").toLowerCase();
  const rawPaymentStatus = String(raw.payment_status?.slug || raw.payment_status || raw.payment_method || "").toLowerCase();
  const paidStatuses = new Set(["paid", "completed", "تم الدفع", "مدفوع"]);
  const completedStatuses = new Set(["completed", "delivered", "fulfilled", "مكتمل", "تم التوصيل"]);
  if (isOrder && connection.sync_paid_orders_only && rawPaymentStatus && !paidStatuses.has(rawPaymentStatus)) {
    await query(`INSERT INTO app_sync_logs (tenant_id, connection_id, provider, event_type, external_id, status, message)
      VALUES ($1, $2, 'salla', $3, $4, 'skipped', 'تم تجاهل الطلب لأنه غير مدفوع')`,
      [connection.tenantId, connection.id, event, String(raw.id || raw.reference_id || "") || null]);
    return { ok: true, skipped: true };
  }
  if (isOrder && connection.sync_completed_orders_only && rawStatus && !completedStatuses.has(rawStatus)) {
    await query(`INSERT INTO app_sync_logs (tenant_id, connection_id, provider, event_type, external_id, status, message)
      VALUES ($1, $2, 'salla', $3, $4, 'skipped', 'تم تجاهل الطلب لأنه غير مكتمل')`,
      [connection.tenantId, connection.id, event, String(raw.id || raw.reference_id || "") || null]);
    return { ok: true, skipped: true };
  }
  const syncResult = await transaction(async (client) => {
    try {
      const customerData = isCustomer ? raw : raw.customer || {};
      const externalCustomerId = isCustomer ? eventCustomerId(payload) : String(customerData.id || "").trim();
      const name = isCustomer
        ? String(customerData.name || `${customerData.first_name || ""} ${customerData.last_name || ""}`).trim()
        : order.customerName;
      const phone = String(customerData.mobile || customerData.phone || order.phone || "").replace(/\D/g, "") || null;
      const emailInput = validateOptionalEmail(customerData.email || order.email);
      if (!emailInput.ok) throw new Error(emailInput.message);
      const email = normalizeOptionalEmail(emailInput.value);
      let customer = { rows: [] };
      if (externalCustomerId) {
        customer = await client.query(
          `SELECT id FROM customers
            WHERE tenant_id = $1 AND external_provider = 'salla' AND external_customer_id = $2
            LIMIT 1`,
          [connection.tenantId, externalCustomerId]
        );
      }
      if (!customer.rows[0] && phone) {
        customer = await client.query(
          `SELECT id FROM customers
            WHERE tenant_id = $1 AND COALESCE(whatsapp_number, phone) = $2
            LIMIT 1`,
          [connection.tenantId, phone]
        );
      }
      if (!customer.rows[0] && email) {
        customer = await client.query(
          `SELECT id FROM customers
            WHERE tenant_id = $1 AND email IS NOT NULL AND lower(email) = lower($2)
            LIMIT 1`,
          [connection.tenantId, email]
        );
      }
      if (!customer.rows[0]) {
        if (!name && !phone) throw new Error("تعذر إنشاء العميل: يلزم الاسم أو رقم الجوال.");
        customer = await client.query(
          `INSERT INTO customers (tenant_id, name, email, phone, whatsapp_number, status, external_provider, external_customer_id)
           VALUES ($1, $2, $3, $4, $4, 'active', 'salla', NULLIF($5, '')) RETURNING id`,
          [connection.tenantId, name || "عميل سلة", email, phone, externalCustomerId]
        );
      } else {
        await client.query(`UPDATE customers SET name = COALESCE(NULLIF($1, ''), name), email = COALESCE($2, email),
          phone = COALESCE($3, phone), whatsapp_number = COALESCE($3, whatsapp_number),
          external_provider = 'salla', external_customer_id = COALESCE(NULLIF($4, ''), external_customer_id), updated_at = now()
          WHERE id = $5 AND tenant_id = $6`, [name, email, phone, externalCustomerId, customer.rows[0].id, connection.tenantId]);
      }
      const customerId = customer.rows[0].id;
      if (isCustomer) {
        await logSync(client, { tenantId: connection.tenantId, connectionId: connection.id, event, externalId: externalCustomerId, status: "success", message: "تم إنشاء العميل أو تحديثه" });
        return { ok: true, customerOnly: true };
      }
      if (!order.externalOrderId || !order.orderNumber) throw new Error("رقم الطلب الخارجي غير موجود");
      const orderStatus = String(raw.status?.slug || raw.status || event.replace("order.", ""));
      const paymentStatus = String(raw.payment_method || raw.payment_status || "");
      await client.query(
        `INSERT INTO external_orders (tenant_id, connection_id, provider, external_order_id, order_number,
          customer_id, status, payment_status, total_amount, currency, raw_payload, ordered_at,
          customer_email, items, detected_plan_name, detected_duration_days, detection_confidence)
         VALUES ($1, $2, 'salla', $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11,
          $12, $13::jsonb, $14, $15, $16)
         ON CONFLICT (tenant_id, provider, external_order_id) DO UPDATE SET
          order_number = EXCLUDED.order_number, customer_id = EXCLUDED.customer_id, status = EXCLUDED.status,
          payment_status = EXCLUDED.payment_status, total_amount = EXCLUDED.total_amount,
          currency = EXCLUDED.currency, raw_payload = EXCLUDED.raw_payload,
          customer_email = EXCLUDED.customer_email, items = EXCLUDED.items,
          detected_plan_name = EXCLUDED.detected_plan_name,
          detected_duration_days = EXCLUDED.detected_duration_days,
          detection_confidence = EXCLUDED.detection_confidence, updated_at = now()`,
        [connection.tenantId, connection.id, order.externalOrderId, order.orderNumber, customerId, orderStatus,
          paymentStatus, order.price, raw.currency || "SAR", JSON.stringify(raw), raw.created_at || payload.created_at || new Date(),
          email, JSON.stringify(order.items), durationMatch.rule?.name || order.planName,
          durationMatch.durationDays, durationMatch.confidence]
      );
      let subscriptionId = null;
      if (connection.auto_create_subscriptions && connection.map_order_to_subscription) {
        const subscription = await client.query(
          `INSERT INTO subscriptions (tenant_id, customer_id, order_number, service_name, plan_name, start_date, end_date, status, price)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
           ON CONFLICT (tenant_id, order_number) DO UPDATE SET
             customer_id = EXCLUDED.customer_id, service_name = EXCLUDED.service_name,
             plan_name = EXCLUDED.plan_name, start_date = EXCLUDED.start_date,
             end_date = EXCLUDED.end_date, price = EXCLUDED.price, updated_at = now()
           RETURNING id`, [connection.tenantId, customerId, order.orderNumber, order.serviceName,
            durationMatch.rule?.name || order.planName, order.startDate, order.endDate, order.price]
        );
        subscriptionId = subscription.rows[0].id;
        if (connection.sync_order_status && ["order.cancelled", "order.refunded", "order.deleted"].includes(event)) {
          await client.query(
            "UPDATE subscriptions SET status = 'cancelled', updated_at = now() WHERE id = $1 AND tenant_id = $2",
            [subscriptionId, connection.tenantId]
          );
        }
      }
      await client.query("UPDATE app_connections SET last_sync_at = now(), last_error = NULL, updated_at = now() WHERE id = $1", [connection.id]);
      await logSync(client, { tenantId: connection.tenantId, connectionId: connection.id, event, externalId: order.externalOrderId, status: "success", message: subscriptionId ? "تمت مزامنة الطلب وإنشاء الاشتراك" : "تمت مزامنة الطلب" });
      return { ok: true, subscriptionId, customerId, order };
    } catch (error) {
      await logSync(client, { tenantId: connection.tenantId, connectionId: connection.id, event, status: "failed", message: String(error.message).slice(0, 300) });
      throw error;
    }
  });

  if (!syncResult?.subscriptionId || !connection.auto_create_order_links || connection.link_creation_mode === "manual") {
    return syncResult;
  }
  const templateId = connection.default_template_id
    || await ensureSallaTemplate(connection.tenantId, connection.provider_store_name || "متجر سلة");
  const link = await createOrderInfoLink({
    tenantId: connection.tenantId,
    userId: null,
    subscriptionId: syncResult.subscriptionId,
    templateId,
    sendMethod: "copy",
    source: "salla",
    externalOrderId: syncResult.order.externalOrderId
  });
  if (!link.ok) {
    await query(`INSERT INTO app_sync_logs
      (tenant_id, connection_id, provider, event_type, external_id, status, message)
      VALUES ($1, $2, 'salla', $3, $4, 'failed', $5)`,
      [connection.tenantId, connection.id, event, syncResult.order.externalOrderId, "تمت المزامنة لكن تعذر إنشاء رابط معلومات الطلب"]);
    return { ...syncResult, linkCreated: false };
  }

  await query("UPDATE subscriptions SET renewal_url = $1 WHERE id = $2 AND tenant_id = $3", [
    link.item.publicUrl, syncResult.subscriptionId, connection.tenantId
  ]);

  if (connection.notify_customer_after_link_created && connection.send_method === "whatsapp") {
    const channel = await query(
      "SELECT id FROM whatsapp_channels WHERE tenant_id = $1 AND status = 'connected' ORDER BY connected_at DESC LIMIT 1",
      [connection.tenantId]
    );
    if (channel.rows[0]) {
      const customer = await query(
        `SELECT name, COALESCE(whatsapp_number, phone) AS phone
           FROM customers WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [syncResult.customerId, connection.tenantId]
      );
      const messageBody = `مرحبًا ${customer.rows[0]?.name || "عميلنا"}،\nيمكنك عرض معلومات طلبك ومدة اشتراكك من خلال الرابط التالي:\n${link.item.publicUrl}\n\nشكرًا لك،\n${connection.store_display_name || connection.provider_store_name || "المتجر"}`;
      const queued = await enqueueMessage({
        tenantId: connection.tenantId,
        customerId: syncResult.customerId,
        subscriptionId: syncResult.subscriptionId,
        whatsappChannelId: channel.rows[0].id,
        channelType: "whatsapp",
        messageType: "order_info_link",
        destination: customer.rows[0]?.phone,
        messageBody,
        referenceType: "salla_order",
        referenceId: syncResult.order.externalOrderId,
        triggerKey: `salla-order-link:${connection.tenantId}:${syncResult.order.externalOrderId}`,
        sourceMode: "automatic",
        enforceConnected: true
      });
      if (!queued.ok) {
        await query(`INSERT INTO app_sync_logs
          (tenant_id, connection_id, provider, event_type, external_id, status, message)
          VALUES ($1, $2, 'salla', $3, $4, 'skipped', $5)`,
          [connection.tenantId, connection.id, event, syncResult.order.externalOrderId,
            `تم إنشاء الرابط ولم تُصف الرسالة: ${queued.reason}`]
        );
        if (queued.reason === PLAN_MESSAGE_LIMIT_REACHED) {
          const issueMessage = "تم إنشاء الطلب والرابط، لكن لم يتم إرسال الرسالة بسبب اكتمال حد رسائل الباقة.";
          await recordOperationalIssue({
            tenantId: connection.tenantId,
            category: "message_quota",
            source: "salla_order_sync",
            sourceId: syncResult.order.externalOrderId,
            severity: "warning",
            message: issueMessage,
            suggestedSolution: "قم بترقية الباقة أو انتظر بداية دورة الرسائل القادمة.",
            metadata: { orderId: syncResult.order.externalOrderId, subscriptionId: syncResult.subscriptionId }
          }).catch(() => null);
          await createInAppNotification({
            tenantId: connection.tenantId,
            type: "message_usage_limit_reached",
            title: "تم إنشاء الطلب دون إرسال الرسالة",
            message: issueMessage,
            priority: "high",
            actionUrl: "/dashboard/billing",
            metadata: { orderId: syncResult.order.externalOrderId },
            dedupeKey: `salla-quota:${connection.tenantId}:${syncResult.order.externalOrderId}`
          }).catch(() => null);
        }
      }
    } else {
      await query(`INSERT INTO app_sync_logs
        (tenant_id, connection_id, provider, event_type, external_id, status, message)
        VALUES ($1, $2, 'salla', $3, $4, 'skipped', 'تم إنشاء الرابط ولم يرسل لعدم وجود جهاز واتساب متصل')`,
        [connection.tenantId, connection.id, event, syncResult.order.externalOrderId]);
    }
  }
  return { ...syncResult, linkCreated: true };
}

export async function queueSallaWebhookEvent(payload) {
  const storeId = eventStoreId(payload);
  const eventType = String(payload?.event || payload?.type || "unknown");
  if (!storeId) return { ok: true, ignored: true, reason: "store_missing" };
  const connection = await query(
    "SELECT id,tenant_id FROM app_connections WHERE provider='salla' AND provider_store_id=$1 AND status='connected' LIMIT 1",
    [storeId]
  );
  if (!connection.rows[0]) return { ok: true, ignored: true, reason: "connection_missing" };
  const externalEventId = `${storeId}:${eventType}:${webhookExternalId(payload)}`;
  const inserted = await query(
    `INSERT INTO webhook_events
       (provider,external_event_id,tenant_id,connection_id,event_type,payload)
     VALUES ('salla',$1,$2,$3,$4,$5::jsonb)
     ON CONFLICT (provider,external_event_id) DO NOTHING RETURNING id`,
    [externalEventId, connection.rows[0].tenant_id, connection.rows[0].id, eventType, JSON.stringify(payload)]
  );
  return { ok: true, accepted: true, duplicate: !inserted.rows[0], eventId: inserted.rows[0]?.id || null };
}

export async function runSallaWebhookWorker() {
  const claimed = await transaction(async (client) => {
    const rows = await client.query(
      `SELECT id,payload FROM webhook_events
        WHERE provider='salla' AND processing_status IN ('received','failed') AND attempts < 5
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20`
    );
    if (rows.rows.length) await client.query(
      "UPDATE webhook_events SET processing_status='processing',attempts=attempts+1,updated_at=now() WHERE id = ANY($1::uuid[])",
      [rows.rows.map((row) => row.id)]
    );
    return rows.rows;
  });
  let completed = 0;
  let failed = 0;
  for (const item of claimed) {
    try {
      await processSallaEvent(item.payload, { sendNotifications: true });
      await query("UPDATE webhook_events SET processing_status='completed',processed_at=now(),error_message=NULL,updated_at=now() WHERE id=$1", [item.id]);
      completed += 1;
    } catch (error) {
      await query("UPDATE webhook_events SET processing_status='failed',error_message=$2,updated_at=now() WHERE id=$1", [item.id, String(error?.message || "processing_failed").slice(0, 500)]);
      failed += 1;
    }
  }
  return { claimed: claimed.length, completed, failed };
}

export async function getSallaAccessToken(connection) {
  if (!connection?.access_token_encrypted) throw new Error("Salla access token is missing");
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null;
  if (!expiresAt || expiresAt > Date.now() + 60_000) {
    return decryptSecret(connection.access_token_encrypted, process.env.ENCRYPTION_KEY);
  }
  if (!connection.refresh_token_encrypted) throw new Error("Salla refresh token is missing");
  const response = await fetch("https://accounts.salla.sa/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptSecret(connection.refresh_token_encrypted, process.env.ENCRYPTION_KEY),
      client_id: process.env.SALLA_CLIENT_ID || "",
      client_secret: process.env.SALLA_CLIENT_SECRET || ""
    })
  });
  const tokens = await response.json().catch(() => ({}));
  if (!response.ok || !tokens.access_token) {
    await query("UPDATE app_connections SET status = 'expired', last_error = 'انتهت صلاحية ربط سلة', updated_at = now() WHERE id = $1", [connection.id]);
    throw new Error(`Salla token refresh failed (${response.status})`);
  }
  const tokenExpiresAt = tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000) : null;
  await query(`UPDATE app_connections SET access_token_encrypted = $2,
    refresh_token_encrypted = COALESCE($3, refresh_token_encrypted), token_expires_at = $4,
    status = 'connected', last_error = NULL, updated_at = now() WHERE id = $1`, [
    connection.id,
    encryptSecret(tokens.access_token, process.env.ENCRYPTION_KEY),
    tokens.refresh_token ? encryptSecret(tokens.refresh_token, process.env.ENCRYPTION_KEY) : null,
    tokenExpiresAt
  ]);
  return tokens.access_token;
}
