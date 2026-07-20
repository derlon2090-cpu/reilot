import { parsePhoneNumberFromString } from "libphonenumber-js";

const TEMPLATE_VARIABLES = new Set([
  "customer_name", "plan_name", "expiry_date", "days_remaining",
  "renewal_url", "store_name", "order_number", "subscription_id"
]);

function validDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("invalid_date");
  return date;
}

function daysInUtcMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function addSubscriptionDuration(value, amount, unit) {
  const date = validDate(value);
  const quantity = Number(amount);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 3650) throw new Error("invalid_duration");
  if (unit === "day") date.setUTCDate(date.getUTCDate() + quantity);
  else if (unit === "month") {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + quantity);
    date.setUTCDate(Math.min(day, daysInUtcMonth(date.getUTCFullYear(), date.getUTCMonth())));
  } else if (unit === "year") {
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCFullYear(date.getUTCFullYear() + quantity);
    date.setUTCMonth(month);
    date.setUTCDate(Math.min(day, daysInUtcMonth(date.getUTCFullYear(), month)));
  } else throw new Error("invalid_duration_unit");
  return date;
}

export function normalizeSubscriptionEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizeSubscriptionPhone(value, countryCode = "SA") {
  let phone = String(value || "").trim().replace(/[\s().-]/g, "");
  if (!phone) return null;
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (/^9665\d{8}$/.test(phone)) phone = `+${phone}`;
  const country = String(countryCode || "SA").toUpperCase();
  const defaultCountry = /^[A-Z]{2}$/.test(country) ? country : /966/.test(country) ? "SA" : "SA";
  const parsed = parsePhoneNumberFromString(phone, defaultCountry);
  return parsed?.isValid() ? parsed.number : null;
}

function scalar(value) {
  if (value && typeof value === "object") return value.slug ?? value.status ?? value.id ?? null;
  return value ?? null;
}

export function normalizeSallaSubscriptionOrder(payload) {
  const data = payload?.data || payload || {};
  const customer = data.customer || {};
  const receiver = data.receiver || {};
  const payment = data.payment || {};
  const items = Array.isArray(data.items) ? data.items : Array.isArray(data.products) ? data.products : [];
  const orderId = String(data.id || data.order_id || data.reference_id || "").trim();
  return {
    orderId,
    orderNumber: String(data.reference_id || data.reference || data.id || "").trim(),
    orderStatus: String(scalar(data.status) || "").trim().toLowerCase(),
    paymentStatus: String(scalar(payment.status) || scalar(data.payment_status) || "").trim().toLowerCase(),
    activatedAt: data.updated_at?.date || data.updated_at || data.created_at?.date || data.created_at || payload?.created_at || new Date().toISOString(),
    amount: Number(data.amounts?.total?.amount ?? data.total?.amount ?? data.total ?? 0) || 0,
    currency: String(data.currency || data.amounts?.total?.currency || "SAR"),
    customer: {
      externalId: String(customer.id || "").trim() || null,
      name: String(customer.name || `${customer.first_name || ""} ${customer.last_name || ""}` || receiver.name || "").trim(),
      email: normalizeSubscriptionEmail(customer.email || receiver.email || data.customer_email),
      phone: normalizeSubscriptionPhone(customer.mobile || customer.phone || receiver.phone || data.customer_phone, customer.country_code || receiver.country_code || "SA"),
      countryCode: String(customer.country_code || receiver.country_code || "SA").toUpperCase()
    },
    items: items.map((item, index) => ({
      orderItemId: String(item.id || item.item_id || `${orderId}:${index}`).trim(),
      productId: String(item.product?.id || item.product_id || item.id || "").trim() || null,
      variantId: String(item.variant?.id || item.variant_id || item.option?.id || "").trim() || null,
      sku: String(item.sku || item.product?.sku || item.variant?.sku || "").trim() || null,
      name: String(item.name || item.product?.name || "").trim(),
      quantity: Math.max(1, Math.trunc(Number(item.quantity || 1) || 1)),
      amount: Number(item.amounts?.total?.amount ?? item.price?.amount ?? item.price ?? 0) || 0
    }))
  };
}

export function findProductPlanMapping(item, mappings) {
  const active = (mappings || []).filter((mapping) => mapping.isActive !== false && mapping.is_active !== false);
  const variantId = String(item?.variantId || "");
  const productId = String(item?.productId || "");
  const sku = String(item?.sku || "").trim().toLowerCase();
  if (variantId) {
    const variant = active.find((mapping) => String(mapping.sallaVariantId ?? mapping.salla_variant_id ?? "") === variantId);
    if (variant) return variant;
  }
  if (productId) {
    const product = active.find((mapping) => String(mapping.sallaProductId ?? mapping.salla_product_id ?? "") === productId && !String(mapping.sallaVariantId ?? mapping.salla_variant_id ?? ""));
    if (product) return product;
  }
  return sku ? active.find((mapping) => String(mapping.sallaProductSku ?? mapping.salla_product_sku ?? "").trim().toLowerCase() === sku) || null : null;
}

export function orderMeetsStartTrigger(order, mapping) {
  const trigger = mapping.startTrigger ?? mapping.start_trigger ?? "payment_completed";
  if (trigger === "manual_activation") return false;
  if (trigger === "payment_completed") return ["paid", "completed", "success", "successful"].includes(order.paymentStatus);
  if (trigger === "order_completed") return ["completed", "delivered", "fulfilled"].includes(order.orderStatus);
  if (trigger === "specific_order_status") return order.orderStatus === String(mapping.specificOrderStatus ?? mapping.specific_order_status ?? "").toLowerCase();
  return false;
}

export function renewalBaseDate({ expiresAt, activatedAt, expiredPolicy = "from_payment_date", now = new Date() }) {
  const expiry = validDate(expiresAt);
  const activation = validDate(activatedAt);
  if (expiry >= validDate(now)) return expiry;
  return expiredPolicy === "continue_from_old_expiry" ? expiry : activation;
}

export function validateRenewalTemplate(value) {
  const unknown = [...canonicalizeRenewalTemplate(value).matchAll(/{{\s*([a-z0-9_]+)\s*}}/gi)]
    .map((match) => match[1].toLowerCase())
    .filter((name) => !TEMPLATE_VARIABLES.has(name));
  return { ok: unknown.length === 0, unknown: [...new Set(unknown)] };
}

export function renderRenewalTemplate(value, variables) {
  const validation = validateRenewalTemplate(value);
  if (!validation.ok) throw new Error(`unsupported_template_variables:${validation.unknown.join(",")}`);
  return canonicalizeRenewalTemplate(value).replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, name) => String(variables?.[name.toLowerCase()] ?? ""));
}

export function canonicalizeRenewalTemplate(value) {
  return String(value || "")
    .replace(/{{\s*(?:اسم_العميل|name)\s*}}/g, "{{customer_name}}")
    .replace(/{{\s*(?:اسم_الخدمة|service_name)\s*}}/g, "{{plan_name}}")
    .replace(/{{\s*(?:تاريخ_الانتهاء|end_date)\s*}}/g, "{{expiry_date}}")
    .replace(/{{\s*الأيام_المتبقية\s*}}/g, "{{days_remaining}}")
    .replace(/{{\s*(?:رابط_التجديد|renewal_link)\s*}}/g, "{{renewal_url}}")
    .replace(/{{\s*رقم_الطلب\s*}}/g, "{{order_number}}")
    .replace(/{{\s*اسم_المتجر\s*}}/g, "{{store_name}}");
}

export function reminderIdempotencyKey({ subscriptionId, type, scheduledFor, channel }) {
  return `subscription:${subscriptionId}:${type}:${validDate(scheduledFor).toISOString()}:${channel}`;
}

export function shouldShowSentBadge(sentAt, now = new Date()) {
  if (!sentAt) return false;
  const elapsed = validDate(now).getTime() - validDate(sentAt).getTime();
  return elapsed >= 0 && elapsed < 72 * 60 * 60 * 1000;
}

export function subscriptionDisplayState(status, expiresAt, now = new Date(), windowDays = 7) {
  if (status !== "active") return status;
  const remaining = Math.ceil((validDate(expiresAt).getTime() - validDate(now).getTime()) / 86400000);
  return remaining >= 0 && remaining <= windowDays ? "expiring_soon" : status;
}

export const supportedRenewalTemplateVariables = [...TEMPLATE_VARIABLES];
