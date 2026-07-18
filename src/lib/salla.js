import crypto from "node:crypto";

function stateSecret() {
  const value = process.env.SALLA_OAUTH_STATE_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("SALLA_OAUTH_STATE_SECRET is required");
  return value;
}

export function createSallaState(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 10 * 60_000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySallaState(value) {
  try {
    const [body, signature] = String(value || "").split(".");
    if (!body || !signature) return null;
    const expected = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export function verifySallaWebhook(rawBody, signature, secret = process.env.SALLA_WEBHOOK_SECRET) {
  if (!rawBody || !signature || !secret) return false;
  const hex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const base64 = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return [hex, base64].some((expected) => {
    const supplied = String(signature).trim();
    return supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  });
}

function dateOnly(value) {
  const parsed = value ? new Date(value) : new Date();
  const safe = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return safe.toISOString().slice(0, 10);
}

export function normalizeSallaOrder(payload, durationDays = 30) {
  const data = payload?.data || payload || {};
  const customer = data.customer || {};
  const first = customer.first_name || customer.firstName || "";
  const last = customer.last_name || customer.lastName || "";
  const customerName = String(customer.name || `${first} ${last}` || "عميل سلة").trim() || "عميل سلة";
  const phone = String(customer.mobile || customer.phone || customer.mobile_number || "").replace(/\D/g, "");
  const externalOrderId = String(data.id || data.order_id || data.reference_id || data.reference || "").trim();
  const orderNumber = String(data.reference_id || data.reference || data.id || "").trim();
  const items = Array.isArray(data.items) ? data.items : [];
  const firstItem = items[0] || {};
  const startDate = dateOnly(data.created_at || data.date?.date || payload?.created_at);
  const end = new Date(`${startDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + Math.max(1, Math.min(3650, Number(durationDays) || 30)));
  return {
    externalOrderId,
    orderNumber,
    customerName,
    email: customer.email || null,
    phone: phone || null,
    serviceName: String(firstItem.name || data.service_name || "طلب سلة").slice(0, 240),
    planName: String(firstItem.sku || firstItem.name || data.plan_name || "اشتراك سلة").slice(0, 240),
    startDate,
    endDate: end.toISOString().slice(0, 10),
    price: Number(data.amounts?.total?.amount || data.total?.amount || data.total || 0) || 0
  };
}
