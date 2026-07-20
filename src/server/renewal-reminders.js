import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { enqueueMessage } from "./message-queue.js";
import { renderRenewalTemplate, validateRenewalTemplate } from "../lib/subscription-lifecycle.js";
import { createRenewalRedirect } from "./product-renewal-options.js";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "https://renvix.app").replace(/\/$/, "");
}

function masked(value) {
  const text = String(value || "");
  if (text.includes("@")) {
    const [name, domain] = text.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return text.length > 7 ? `${text.slice(0, 4)}••••${text.slice(-3)}` : text;
}

async function createTrackingUrl(tenantId, subscriptionId, destinationUrl) {
  if (!destinationUrl) return null;
  let destination;
  try { destination = new URL(destinationUrl); } catch { return null; }
  if (destination.protocol !== "https:") return null;
  const token = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  await query(
    `INSERT INTO renewal_tracking_links
       (tenant_id,subscription_id,token_hash,token_prefix,destination_url,expires_at)
     VALUES ($1,$2,$3,$4,$5,now()+interval '45 days')`,
    [tenantId, subscriptionId, hash, token.slice(0, 10), destination.toString()]
  );
  return `${appUrl()}/r/${token}`;
}

async function renewalUrlForChannel(tenantId, subscriptionId, channel, createLink) {
  const result = await query(`SELECT pro.id
    FROM customer_subscriptions cs
    JOIN LATERAL (
      SELECT ppm.id FROM product_plan_mappings ppm
      WHERE ppm.tenant_id=cs.tenant_id AND ppm.is_active=true
        AND ((cs.salla_variant_id IS NOT NULL AND ppm.salla_variant_id=cs.salla_variant_id)
          OR (ppm.salla_variant_id IS NULL AND ppm.salla_product_id=cs.salla_product_id))
      ORDER BY CASE WHEN cs.salla_variant_id IS NOT NULL AND ppm.salla_variant_id=cs.salla_variant_id THEN 1 ELSE 2 END
      LIMIT 1
    ) ppm ON true
    JOIN product_renewal_options pro ON pro.tenant_id=cs.tenant_id AND pro.product_mapping_id=ppm.id
      AND pro.is_active=true
      AND (($3='whatsapp' AND pro.show_in_whatsapp=true) OR ($3='email' AND pro.show_in_email=true))
      AND ((pro.link_mode='manual' AND pro.manual_url IS NOT NULL)
        OR (pro.link_mode='automatic' AND pro.resolved_url IS NOT NULL))
    WHERE cs.id=$2 AND cs.tenant_id=$1
    ORDER BY pro.sort_order,pro.created_at LIMIT 1`, [tenantId, subscriptionId, channel]);
  const optionId = result.rows[0]?.id;
  if (!optionId) return null;
  if (!createLink) return `${appUrl()}/r/[رابط آمن عند الجدولة]`;
  const link = await createRenewalRedirect({ tenantId, subscriptionId, optionId, expiresInDays: 45 });
  return link.ok ? link.url : null;
}

async function deliveryContext(tenantId, subscriptionId, requestedChannel = null, { createLink = false } = {}) {
  const result = await query(
    `SELECT cs.*, sc.full_name AS customer_name, sc.email, sc.phone_e164, sc.email_eligible,
            sc.whatsapp_eligible, sc.legacy_customer_id, sp.name AS plan_name, sp.salla_product_url,
            COALESCE(t.name,'Renvix') AS store_name,
            wc.id AS whatsapp_channel_id, wc.status AS whatsapp_status,
            COALESCE(wc.risk_score,0) AS whatsapp_risk
       FROM customer_subscriptions cs
       JOIN subscription_customers sc ON sc.id=cs.customer_id
       JOIN subscription_plans sp ON sp.id=cs.plan_id
       JOIN tenants t ON t.id=cs.tenant_id
       LEFT JOIN LATERAL (SELECT id,status,risk_score FROM whatsapp_channels
         WHERE tenant_id=cs.tenant_id ORDER BY connected_at DESC NULLS LAST,created_at DESC LIMIT 1) wc ON true
      WHERE cs.id=$1 AND cs.tenant_id=$2 LIMIT 1`,
    [subscriptionId, tenantId]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: "subscription_not_found" };
  if (row.status !== "active") return { ok: false, reason: "subscription_not_active" };
  const preferred = requestedChannel || row.preferred_channel;
  const candidates = [preferred, row.fallback_channel].filter((channel, index, list) => channel && list.indexOf(channel) === index);
  let channel = null;
  for (const candidate of candidates) {
    if (candidate === "whatsapp" && row.whatsapp_eligible && row.phone_e164 && row.whatsapp_status === "connected" && Number(row.whatsapp_risk || 0) < 80) { channel = candidate; break; }
    if (candidate === "email" && row.email_eligible && row.email) { channel = candidate; break; }
  }
  if (!channel) return { ok: false, reason: "missing_contact_channel" };
  const template = await query(
    `SELECT id,subject,body,name FROM renewal_message_templates
      WHERE tenant_id=$1 AND channel=$2 AND is_active=true
      ORDER BY is_default DESC,updated_at DESC LIMIT 1`,
    [tenantId, channel]
  );
  if (!template.rows[0]) return { ok: false, reason: "missing_renewal_template", channel };
  const bodyValidation = validateRenewalTemplate(template.rows[0].body);
  const subjectValidation = validateRenewalTemplate(template.rows[0].subject || "");
  if (!bodyValidation.ok || !subjectValidation.ok) return { ok: false, reason: "invalid_renewal_template", channel };
  const configuredRenewalUrl = await renewalUrlForChannel(tenantId, subscriptionId, channel, createLink);
  const renewalUrl = configuredRenewalUrl || (createLink
    ? await createTrackingUrl(tenantId, subscriptionId, row.salla_product_url)
    : row.salla_product_url ? `${appUrl()}/r/[رابط آمن عند الجدولة]` : null);
  const daysRemaining = Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / 86400000);
  const variables = {
    customer_name: row.customer_name,
    plan_name: row.plan_name,
    expiry_date: new Date(row.expires_at).toISOString().slice(0, 10),
    days_remaining: Math.max(0, daysRemaining),
    renewal_url: renewalUrl || "",
    store_name: row.store_name,
    order_number: row.order_number,
    subscription_id: row.id
  };
  const body = renderRenewalTemplate(template.rows[0].body, variables);
  const subject = channel === "email" ? renderRenewalTemplate(template.rows[0].subject || "", variables) : null;
  return { ok: true, row, channel, template: template.rows[0], body, subject,
    destination: channel === "email" ? row.email : row.phone_e164,
    maskedDestination: masked(channel === "email" ? row.email : row.phone_e164), variables };
}

async function fallbackPayload(tenantId, subscriptionId, primaryChannel) {
  const selected = await query("SELECT fallback_channel FROM customer_subscriptions WHERE id=$1 AND tenant_id=$2", [subscriptionId, tenantId]);
  const fallback = selected.rows[0]?.fallback_channel;
  if (!fallback || fallback === primaryChannel) return null;
  const context = await deliveryContext(tenantId, subscriptionId, fallback, { createLink: true });
  return context.ok ? context : null;
}

export async function getSubscriptionReminderPreview(tenantId, subscriptionId) {
  const context = await deliveryContext(tenantId, subscriptionId);
  if (!context.ok) return context;
  return { ok: true, preview: { channel: context.channel, recipient: context.maskedDestination,
    subject: context.subject, body: context.body, templateName: context.template.name } };
}

export async function queueSubscriptionReminder({ tenantId, subscriptionId, reminderId = null, sourceMode = "manual" }) {
  const context = await deliveryContext(tenantId, subscriptionId, null, { createLink: true });
  if (!context.ok) return context;
  const fallback = await fallbackPayload(tenantId, subscriptionId, context.channel);
  const queued = await enqueueMessage({
    tenantId,
    customerId: context.row.legacy_customer_id || null,
    customerSubscriptionId: subscriptionId,
    reminderId,
    whatsappChannelId: context.channel === "whatsapp" ? context.row.whatsapp_channel_id : null,
    templateId: context.template.id,
    channelType: context.channel,
    messageType: "renewal_reminder",
    destination: context.destination,
    emailTo: context.channel === "email" ? context.destination : null,
    subject: context.subject,
    messageBody: context.body,
    referenceType: "customer_subscription",
    referenceId: subscriptionId,
    triggerKey: reminderId ? `reminder:${reminderId}` : `manual:${subscriptionId}:${Date.now()}`,
    sourceMode,
    maxAttempts: context.channel === "whatsapp" ? 2 : 3,
    enforceConnected: context.channel === "whatsapp",
    originalExpiresAt: context.row.expires_at,
    fallbackChannel: fallback?.channel || null,
    fallbackDestination: fallback?.destination || null,
    fallbackSubject: fallback?.subject || null,
    fallbackMessageBody: fallback?.body || null
  });
  if (queued.ok && reminderId) await query(
    "UPDATE subscription_reminders SET status='queued',queue_job_id=$2,updated_at=now() WHERE id=$1 AND tenant_id=$3",
    [reminderId, queued.queueId, tenantId]
  );
  return queued;
}

export async function runDueSubscriptionReminders() {
  const due = await query(
    `SELECT sr.id,sr.tenant_id,sr.subscription_id,sr.original_expires_at,cs.expires_at,cs.status AS subscription_status
       FROM subscription_reminders sr JOIN customer_subscriptions cs ON cs.id=sr.subscription_id
      WHERE sr.status='scheduled' AND sr.scheduled_for<=now() ORDER BY sr.scheduled_for LIMIT 100`
  );
  let queued = 0;
  let skipped = 0;
  for (const item of due.rows) {
    if (item.subscription_status !== "active" || new Date(item.expires_at).getTime() !== new Date(item.original_expires_at).getTime()) {
      await query("UPDATE subscription_reminders SET status='skipped',failure_reason=$2,updated_at=now() WHERE id=$1", [item.id, item.subscription_status !== "active" ? "subscription_not_active" : "subscription_was_renewed"]);
      skipped += 1;
      continue;
    }
    const result = await queueSubscriptionReminder({ tenantId: item.tenant_id, subscriptionId: item.subscription_id, reminderId: item.id, sourceMode: "automatic" });
    if (result.ok) queued += 1;
    else {
      await query("UPDATE subscription_reminders SET status='skipped',failure_reason=$2,updated_at=now() WHERE id=$1", [item.id, result.reason || "queue_failed"]);
      skipped += 1;
    }
  }
  return { candidates: due.rowCount, queued, skipped };
}
