import crypto from "node:crypto";
import { query, transaction } from "../../../src/server/db.js";
import { requireSession } from "../../../src/server/session.js";
import { inferSubscriptionStatus } from "../../../src/lib/orderLinks.js";
import { listSubscriptionOperations, rescheduleSubscriptionReminders, subscriptionOperationsSummary } from "../../../src/server/subscription-operations.js";

const allowedChannels = new Set(["whatsapp", "email"]);
const allowedReminderModes = new Set(["manual", "automatic"]);
const allowedReminderStatuses = new Set(["scheduled", "queued", "processing", "sent", "delivered", "failed", "cancelled", "skipped", "paused"]);

function dateFilter(value) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(new Date(`${text}T00:00:00Z`).getTime()) ? text : "";
}

function deliveryPreferences(body = {}) {
  const days = Number(body.reminderDaysBefore);
  return {
    channel: allowedChannels.has(body.reminderChannel) ? body.reminderChannel : "whatsapp",
    mode: allowedReminderModes.has(body.reminderMode) ? body.reminderMode : "manual",
    daysBefore: Number.isInteger(days) && days >= 0 && days <= 90 ? days : 7
  };
}

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const options = {
    search: url.searchParams.get("search") || "",
    status: url.searchParams.get("status") || "",
    planId: url.searchParams.get("planId") || "",
    channel: url.searchParams.get("channel") || "",
    renewalWindow: Number(String(url.searchParams.get("renewalWindow") || "").replace(/\D/g, "")) || "",
    source: url.searchParams.get("source") || "",
    reminderStatus: allowedReminderStatuses.has(url.searchParams.get("reminderStatus")) ? url.searchParams.get("reminderStatus") : "",
    dateFrom: dateFilter(url.searchParams.get("dateFrom")),
    dateTo: dateFilter(url.searchParams.get("dateTo")),
    page: Number(url.searchParams.get("page") || 1),
    limit: Number(url.searchParams.get("limit") || 20)
  };
  const [listing, meta] = await Promise.all([
    listSubscriptionOperations(auth.session.tenantId, options),
    subscriptionOperationsSummary(auth.session.tenantId)
  ]);
  return Response.json({ ok: true, ...listing, ...meta });
}

const allowedStatuses = new Set(["active", "expiring_soon", "expired", "renewed", "paused", "cancelled"]);

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  if (!body.customerId || !body.serviceName || !body.planName || !body.startDate || !body.endDate) {
    return Response.json({ ok: false, reason: "missing_fields" }, { status: 400 });
  }
  if (new Date(body.endDate) < new Date(body.startDate)) {
    return Response.json({ ok: false, reason: "invalid_dates" }, { status: 400 });
  }
  const preferences = deliveryPreferences(body);
  const status = allowedStatuses.has(body.status) ? body.status : inferSubscriptionStatus(body.startDate, body.endDate) || "active";
  const item = await transaction(async (client) => {
    const customer = await client.query("SELECT id FROM customers WHERE id = $1 AND tenant_id = $2", [body.customerId, auth.session.tenantId]);
    if (!customer.rows[0]) return null;
    const orderNumber = String(body.orderNumber || `RP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`).trim();
    const inserted = await client.query(
      `INSERT INTO subscriptions (
         tenant_id, customer_id, order_number, service_name, plan_name, start_date, end_date,
         renewal_url, status, auto_renew, price, notes,
         reminder_channel, reminder_mode, reminder_days_before
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, order_number AS "orderNumber",
                 reminder_channel AS "reminderChannel", reminder_mode AS "reminderMode",
                 reminder_days_before AS "reminderDaysBefore"`,
      [auth.session.tenantId, body.customerId, orderNumber, body.serviceName, body.planName, body.startDate, body.endDate,
        body.renewalUrl || null, status, Boolean(body.autoRenew), Number(body.price || 0), body.notes || null,
        preferences.channel, preferences.mode, preferences.daysBefore]
    );
    const customerData = await client.query("SELECT id,name,email,COALESCE(whatsapp_number,phone) AS phone FROM customers WHERE id=$1 AND tenant_id=$2", [body.customerId, auth.session.tenantId]);
    await client.query(
      `INSERT INTO subscription_customers
         (id,tenant_id,legacy_customer_id,full_name,phone_e164,email,email_normalized,email_eligible,whatsapp_eligible)
       VALUES ($1,$2,$1,$3,$4,$5,lower($5),$5 IS NOT NULL,$4 IS NOT NULL)
       ON CONFLICT (id) DO UPDATE SET full_name=EXCLUDED.full_name,phone_e164=COALESCE(EXCLUDED.phone_e164,subscription_customers.phone_e164),
         email=COALESCE(EXCLUDED.email,subscription_customers.email),email_normalized=COALESCE(EXCLUDED.email_normalized,subscription_customers.email_normalized),updated_at=now()`,
      [body.customerId, auth.session.tenantId, customerData.rows[0]?.name || "عميل", customerData.rows[0]?.phone || null, customerData.rows[0]?.email || null]
    );
    const days = Math.max(1, Math.ceil((new Date(body.endDate).getTime() - new Date(body.startDate).getTime()) / 86400000));
    const plan = await client.query(
      `INSERT INTO subscription_plans (tenant_id,name,duration_value,duration_unit)
       VALUES ($1,$2,$3,'day') ON CONFLICT (tenant_id,name) DO UPDATE SET updated_at=now() RETURNING id`,
      [auth.session.tenantId, body.planName, days]
    );
    await client.query(
      `INSERT INTO customer_subscriptions
         (id,tenant_id,customer_id,plan_id,legacy_subscription_id,salla_order_id,salla_order_item_id,salla_product_id,
          order_number,service_name,status,starts_at,expires_at,reminder_mode,reminder_days,preferred_channel,fallback_channel,source,amount)
       VALUES ($1,$2,$3,$4,$1,$5,$5,'manual',$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,'manual',$15)
       ON CONFLICT (id) DO NOTHING`,
      [inserted.rows[0].id, auth.session.tenantId, body.customerId, plan.rows[0].id, `manual:${inserted.rows[0].id}`,
        orderNumber, body.serviceName, status === "expiring_soon" ? "active" : status,
        body.startDate, body.endDate, preferences.mode, JSON.stringify([preferences.daysBefore]), preferences.channel,
        allowedChannels.has(body.fallbackChannel) && body.fallbackChannel !== preferences.channel ? body.fallbackChannel : null,
        Number(body.price || 0)]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, customer_id, type, title, metadata)
       VALUES ($1, $2, $3, 'subscription.created', 'Subscription created', $4::jsonb)`,
      [auth.session.tenantId, auth.session.userId, body.customerId, JSON.stringify({ subscriptionId: inserted.rows[0].id, orderNumber })]
    );
    return inserted.rows[0];
  });
  if (!item) return Response.json({ ok: false, reason: "customer_not_found" }, { status: 404 });
  if (preferences.mode === "automatic") {
    await rescheduleSubscriptionReminders(auth.session.tenantId, item.id, true);
  }
  return Response.json({ ok: true, item }, { status: 201 });
}
