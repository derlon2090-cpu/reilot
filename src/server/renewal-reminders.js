import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { enqueueMessage } from "./message-queue.js";
import { isSubscriptionReminderEnabled, renderRenewalTemplate, validateRenewalTemplate } from "../lib/subscription-lifecycle.js";
import { createRenewalRedirect } from "./product-renewal-options.js";
import { siteBaseUrl } from "./app-url.js";

function appUrl() {
  return siteBaseUrl();
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

async function deliveryContext(tenantId, subscriptionId, requestedChannel = null, { createLink = false, strictChannel = false } = {}) {
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
  if (!isSubscriptionReminderEnabled(row)) {
    return { ok: false, reason: "reminder_disabled", message: "رسالة التذكير متوقفة من إعدادات الاشتراك." };
  }
  const preferred = requestedChannel || row.preferred_channel;
  const candidates = (strictChannel && requestedChannel ? [requestedChannel] : [preferred, row.fallback_channel])
    .filter((channel, index, list) => channel && list.indexOf(channel) === index);
  let channel = null;
  for (const candidate of candidates) {
    if (candidate === "whatsapp" && row.whatsapp_eligible && row.phone_e164 && row.whatsapp_status === "connected" && Number(row.whatsapp_risk || 0) < 80) { channel = candidate; break; }
    if (candidate === "email" && row.email_eligible && row.email) { channel = candidate; break; }
  }
  if (!channel) return { ok: false, reason: "missing_contact_channel" };
  const template = await query(
    `SELECT rmt.id,rmt.subject,rmt.body,rmt.name,
            nt.store_name AS "storeName",nt.theme_color AS "themeColor",
            nt.button_label AS "buttonLabel",nt.footer_text AS "footerText",
            nt.content_json AS "contentJson",
            p.logo_url AS "storeImageUrl",p.logo_border_radius AS "storeImageRadius"
       FROM renewal_message_templates rmt
       LEFT JOIN notification_templates nt ON nt.id=rmt.source_template_id AND nt.tenant_id=rmt.tenant_id
       LEFT JOIN order_link_profiles p ON p.tenant_id=rmt.tenant_id
      WHERE rmt.tenant_id=$1 AND rmt.channel=$2 AND rmt.is_active=true
      ORDER BY rmt.is_default DESC,rmt.updated_at DESC LIMIT 1`,
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
    support_url: `${appUrl()}/support`,
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
  const context = await deliveryContext(tenantId, subscriptionId, fallback, { createLink: true, strictChannel: true });
  return context.ok ? context : null;
}

async function configuredDeliveryMode(tenantId, subscriptionId) {
  const selected = await query(
    "SELECT reminder_delivery_mode FROM customer_subscriptions WHERE id=$1 AND tenant_id=$2",
    [subscriptionId, tenantId]
  );
  return selected.rows[0]?.reminder_delivery_mode === "both" ? "both" : "single";
}

function previewFromContext(context) {
  return {
    channel: context.channel,
    recipient: context.maskedDestination,
    subject: context.subject,
    body: context.body,
    templateName: context.template.name
  };
}

function emailTemplateSnapshot(context) {
  if (context.channel !== "email") return null;
  return {
    type: "renewal_email_v1",
    data: {
      customerName: context.row.customer_name,
      serviceName: context.row.plan_name,
      endDate: context.variables.expiry_date,
      remainingDays: context.variables.days_remaining,
      renewalLink: context.variables.renewal_url,
      supportUrl: context.variables.support_url,
      orderNumber: context.row.order_number,
      storeName: context.template.storeName || context.row.store_name
    },
    template: {
      storeName: context.template.storeName || context.row.store_name,
      storeImageUrl: context.template.storeImageUrl || "",
      storeImageRadius: Number(context.template.storeImageRadius ?? 16),
      title: context.subject,
      body: context.body,
      themeColor: context.template.themeColor || "#062B28",
      buttonLabel: context.template.buttonLabel || "جدد اشتراكك الآن",
      footerText: context.template.footerText || "شكرًا لثقتك بنا",
      emailDesign: context.template.contentJson?.emailDesign || "classic",
      emailContentMode: context.template.contentJson?.emailContentMode || "preset",
      emailHtmlContent: context.template.contentJson?.emailHtmlContent || ""
    }
  };
}

function enqueueReminderContext(context, {
  tenantId, subscriptionId, reminderId, sourceMode, fallback = null, triggerSuffix = ""
}) {
  return enqueueMessage({
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
    templateSnapshot: emailTemplateSnapshot(context),
    referenceType: "customer_subscription",
    referenceId: subscriptionId,
    triggerKey: reminderId
      ? `reminder:${reminderId}${triggerSuffix}`
      : `manual:${subscriptionId}:${context.channel}:${Date.now()}${triggerSuffix}`,
    sourceMode,
    maxAttempts: context.channel === "whatsapp" ? 2 : 3,
    enforceConnected: context.channel === "whatsapp",
    originalExpiresAt: context.row.expires_at,
    fallbackChannel: fallback?.channel || null,
    fallbackDestination: fallback?.destination || null,
    fallbackSubject: fallback?.subject || null,
    fallbackMessageBody: fallback?.body || null
  });
}

export async function getSubscriptionReminderPreview(tenantId, subscriptionId) {
  const deliveryMode = await configuredDeliveryMode(tenantId, subscriptionId);
  if (deliveryMode === "both") {
    const results = await Promise.all(["whatsapp", "email"].map((channel) =>
      deliveryContext(tenantId, subscriptionId, channel, { strictChannel: true })
    ));
    const contexts = results.filter((item) => item.ok);
    if (!contexts.length) return results.find((item) => !item.ok) || { ok: false, reason: "missing_contact_channel" };
    const previews = contexts.map(previewFromContext);
    return { ok: true, preview: {
      channel: previews.length === 2 ? "both" : previews[0].channel,
      recipient: previews.map((item) => item.recipient).join(" · "),
      subject: previews.find((item) => item.channel === "email")?.subject || null,
      body: previews[0].body,
      templateName: previews.map((item) => item.templateName).join(" · "),
      channels: previews
    } };
  }
  const context = await deliveryContext(tenantId, subscriptionId);
  if (!context.ok) return context;
  return { ok: true, preview: previewFromContext(context) };
}

export async function queueSubscriptionReminder({ tenantId, subscriptionId, reminderId = null, sourceMode = "manual" }) {
  const deliveryMode = await configuredDeliveryMode(tenantId, subscriptionId);
  if (deliveryMode === "both") {
    const results = await Promise.all(["whatsapp", "email"].map((channel) =>
      deliveryContext(tenantId, subscriptionId, channel, { createLink: true, strictChannel: true })
    ));
    const contexts = results.filter((item) => item.ok);
    if (!contexts.length) return results.find((item) => !item.ok) || { ok: false, reason: "missing_contact_channel" };
    const unavailableChannels = ["whatsapp", "email"].filter((_, index) => !results[index]?.ok);
    const queuedItems = [];
    const failures = [];
    for (const context of contexts) {
      const queued = await enqueueReminderContext(context, {
        tenantId,
        subscriptionId,
        reminderId: queuedItems.length === 0 ? reminderId : null,
        sourceMode,
        triggerSuffix: `:${context.channel}`
      });
      if (queued.ok) queuedItems.push({ ...queued, channel: context.channel });
      else failures.push({ ...queued, channel: context.channel });
    }
    if (!queuedItems.length) return failures[0] || { ok: false, reason: "queue_failed" };
    if (reminderId) await query(
      "UPDATE subscription_reminders SET status='queued',queue_job_id=$2,updated_at=now() WHERE id=$1 AND tenant_id=$3",
      [reminderId, queuedItems[0].queueId, tenantId]
    );
    return {
      ok: true,
      queueId: queuedItems[0].queueId,
      queueIds: queuedItems.map((item) => item.queueId),
      channels: queuedItems.map((item) => item.channel),
      scheduledFor: queuedItems.map((item) => item.scheduledFor).sort()[0],
      partial: unavailableChannels.length > 0 || failures.length > 0,
      skippedChannels: [...unavailableChannels, ...failures.map((item) => item.channel)]
    };
  }
  const context = await deliveryContext(tenantId, subscriptionId, null, { createLink: true });
  if (!context.ok) return context;
  const fallback = await fallbackPayload(tenantId, subscriptionId, context.channel);
  const queued = await enqueueReminderContext(context, {
    tenantId, subscriptionId, reminderId, sourceMode, fallback
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
