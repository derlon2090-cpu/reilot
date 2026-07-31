import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { renderAdminTemplate } from "./admin-messaging.js";
import { sendQueuedEmail } from "./email/resend.service.js";
import { evolutionSendText } from "./evolution-client.js";
import { encryptSecret } from "../lib/encryption.js";
import { hashPassword } from "./password.js";
import { normalizeSubscriptionPhone } from "../lib/subscription-lifecycle.js";

export const ADMIN_TEMPLATE_KEYS = Object.freeze({
  ACCOUNT_CREATED: "admin_account_created",
  SUBSCRIPTION_RENEWED: "admin_subscription_renewed",
  NUMBER_DISCONNECTED: "admin_number_disconnected",
  SALLA_INSTALLED: "admin_salla_installed"
});

export const EVENT_TEMPLATE_MAP = Object.freeze({
  "account.provisioned": ADMIN_TEMPLATE_KEYS.ACCOUNT_CREATED,
  "subscription.renewed": ADMIN_TEMPLATE_KEYS.SUBSCRIPTION_RENEWED,
  "channel.disconnected": ADMIN_TEMPLATE_KEYS.NUMBER_DISCONNECTED,
  "salla.integration.ready": ADMIN_TEMPLATE_KEYS.SALLA_INSTALLED
});

const MAX_ATTEMPTS = 5;
const PERMANENT_FAILURE_CODES = new Set([
  "ADMIN_TEMPLATE_NOT_FOUND",
  "ADMIN_TEMPLATE_DISABLED",
  "VARIABLE_NOT_ALLOWED",
  "REQUIRED_VARIABLE_MISSING",
  "REQUIRED_VALUE_MISSING",
  "INVALID_RECIPIENT",
  "invalid_recipient",
  "customer_blocked",
  "permanent_provider_rejection"
]);

function workerTemporaryPassword() {
  return `Rv!${crypto.randomBytes(18).toString("base64url")}9a`;
}

function safeFailure(error) {
  const code = String(error?.code || "ADMIN_MESSAGE_SEND_FAILED").slice(0, 80);
  const message = String(error?.message || "provider request failed")
    .replace(/(api[-_ ]?key|token|secret|password)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .slice(0, 300);
  return { code, message };
}

function recipientHash(recipient) {
  return crypto.createHash("sha256").update(String(recipient).trim().toLowerCase()).digest("hex");
}

function encryptedRecipient(recipient) {
  if (!process.env.ENCRYPTION_KEY) return null;
  return encryptSecret(recipient, process.env.ENCRYPTION_KEY);
}

function dateValue(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    timeZone: process.env.APP_TIMEZONE || "Asia/Riyadh"
  }).format(new Date(value));
}

function emailRecipient(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function channelRecipient(channel, { email, phone, emailEligible = true, whatsappEligible = true }) {
  if (channel === "email") return emailEligible === false ? null : emailRecipient(email);
  return whatsappEligible === false ? null : normalizeSubscriptionPhone(phone);
}

function missingRecipientReason(channel) {
  return channel === "email" ? "missing_valid_email" : "missing_valid_phone";
}

function adminEmailLogoUrl() {
  const configured = String(process.env.ADMIN_EMAIL_LOGO_URL || "").trim();
  try {
    if (new URL(configured).protocol === "https:") return configured;
  } catch {}
  return "https://renvix.app/assets/renewpilot-logo-horizontal.webp";
}

export async function enqueueAdminDomainEvent(client, {
  eventType, aggregateType, aggregateId, payloadRefs = {}, idempotencyKey
}) {
  if (!EVENT_TEMPLATE_MAP[eventType]) throw new Error("ADMIN_EVENT_NOT_SUPPORTED");
  const runner = client?.query ? client : { query };
  const result = await runner.query(
    `INSERT INTO admin_event_outbox
       (event_type,aggregate_type,aggregate_id,payload_refs,idempotency_key,status,available_at)
     VALUES ($1,$2,$3,$4::jsonb,$5,'pending',now())
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [eventType, aggregateType, String(aggregateId), JSON.stringify(payloadRefs), idempotencyKey]
  );
  return { queued: Boolean(result.rows[0]), eventId: result.rows[0]?.id || null };
}

async function loadTemplate(templateKey) {
  const result = await query(
    `SELECT template_key AS "templateKey",name,channel,subject,body,
            allowed_variables AS "allowedVariables",required_variables AS "requiredVariables",
            is_active AS "isActive",version
       FROM admin_message_templates WHERE template_key=$1 LIMIT 1`,
    [templateKey]
  );
  return result.rows[0] || null;
}

async function resolveAccountEvent(event, channel) {
  const jobId = event.payload_refs?.provisioningJobId || event.aggregate_id;
  const result = await query(
    `SELECT apj.id,apj.user_id AS "userId",apj.tenant_id AS "tenantId",
            apj.customer_name AS "customerName",apj.customer_email AS "customerEmail",
            apj.customer_phone_e164 AS phone,
            apj.subscription_activated_at AS "activatedAt",
            u.email,COALESCE(pp.name,'Renvix') AS "planName",
            ps.current_period_end AS "subscriptionExpiry"
       FROM account_provisioning_jobs apj
       JOIN users u ON u.id=apj.user_id
       LEFT JOIN platform_plans pp ON pp.id=apj.plan_id
       LEFT JOIN LATERAL (
         SELECT current_period_end FROM platform_subscriptions
          WHERE tenant_id=apj.tenant_id ORDER BY created_at DESC LIMIT 1
       ) ps ON true
      WHERE apj.id=$1 AND apj.status IN ('sending_credentials','email_failed','completed')
      LIMIT 1`,
    [jobId]
  );
  const row = result.rows[0];
  if (!row) return { skip: "account_not_fully_provisioned" };
  const recipient = channelRecipient(channel, { email: row.email, phone: row.phone });
  if (!recipient) return { skip: missingRecipientReason(channel) };
  const temporaryPassword = workerTemporaryPassword();
  await transaction(async (client) => {
    await client.query(
      `UPDATE accounts SET password=$1,updated_at=now()
        WHERE user_id=$2 AND provider_id='credential'`,
      [await hashPassword(temporaryPassword), row.userId]
    );
    await client.query(
      `UPDATE users SET must_change_password=true,password_initialized_at=now(),
              password_changed_at=NULL,updated_at=now() WHERE id=$1`,
      [row.userId]
    );
    await client.query(
      `UPDATE account_provisioning_jobs
          SET status='sending_credentials',credentials_email_status='processing',updated_at=now()
        WHERE id=$1`,
      [jobId]
    );
  });
  return {
    recipient,
    variables: {
      customer_name: row.customerName || "عميل Renvix",
      customer_email: row.email,
      temporary_password: temporaryPassword,
      plan_name: row.planName,
      subscription_expiry: dateValue(row.subscriptionExpiry),
      login_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://renvix.app"}/login`,
      support_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://renvix.app"}/support`
    },
    sensitiveVariables: ["temporary_password"],
    provisioningJobId: jobId
  };
}

async function resolveRenewalEvent(event, channel) {
  if (event.payload_refs?.provisioningJobId) {
    const provisioning = await query(
      `SELECT apj.id,apj.customer_name AS "customerName",apj.customer_email AS email,
              apj.customer_phone_e164 AS phone,apj.previous_expires_at AS "oldExpiry",
              apj.new_expires_at AS "newExpiry",COALESCE(pp.name,'Renvix') AS "planName",
              COALESCE(s.name,t.name,'Renvix') AS "storeName",apj.tenant_id AS "tenantId",
              EXISTS (
                SELECT 1 FROM unsubscribe_list ul
                 WHERE ul.tenant_id=apj.tenant_id AND ul.phone_number=apj.customer_phone_e164
              ) AS blocked
         FROM account_provisioning_jobs apj
         JOIN tenants t ON t.id=apj.tenant_id
         LEFT JOIN platform_plans pp ON pp.id=apj.plan_id
         LEFT JOIN LATERAL (
           SELECT name FROM stores WHERE tenant_id=apj.tenant_id ORDER BY created_at LIMIT 1
         ) s ON true
        WHERE apj.id=$1 AND apj.status='completed'
          AND apj.subscription_activated_at IS NOT NULL
          AND apj.previous_expires_at IS NOT NULL AND apj.new_expires_at IS NOT NULL
        LIMIT 1`,
      [event.payload_refs.provisioningJobId]
    );
    const row = provisioning.rows[0];
    if (!row) return { skip: "renewal_not_committed" };
    const recipient = channelRecipient(channel, { email: row.email, phone: row.phone });
    if (!recipient) return { skip: missingRecipientReason(channel) };
    if (channel === "evolution_whatsapp" && row.blocked) return { skip: "customer_blocked" };
    return {
      recipient,
      variables: {
        customer_name: row.customerName || "عميل Renvix",
        plan_name: row.planName,
        store_name: row.storeName,
        old_expiry: dateValue(row.oldExpiry),
        new_expiry: dateValue(row.newExpiry),
        login_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://renvix.app"}/login`,
        support_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://renvix.app"}/support`
      }
    };
  }
  const renewalId = event.payload_refs?.renewalId || event.aggregate_id;
  const result = await query(
    `SELECT sr.id,sr.previous_expires_at AS "oldExpiry",sr.new_expires_at AS "newExpiry",
            sc.full_name AS "customerName",sc.email,sc.email_eligible AS "emailEligible",
            sc.phone_e164 AS phone,sc.whatsapp_eligible AS "whatsappEligible",
            sp.name AS "planName",COALESCE(s.name,t.name,'Renvix') AS "storeName",
            EXISTS (
              SELECT 1 FROM unsubscribe_list ul
               WHERE ul.tenant_id=sr.tenant_id AND ul.phone_number=sc.phone_e164
            ) AS blocked
       FROM subscription_renewals sr
       JOIN customer_subscriptions cs ON cs.id=sr.subscription_id
       JOIN subscription_customers sc ON sc.id=cs.customer_id
       JOIN subscription_plans sp ON sp.id=cs.plan_id
       JOIN tenants t ON t.id=sr.tenant_id
       LEFT JOIN LATERAL (SELECT name FROM stores WHERE tenant_id=sr.tenant_id ORDER BY created_at LIMIT 1) s ON true
      WHERE sr.id=$1 AND sr.status='completed' LIMIT 1`,
    [renewalId]
  );
  const row = result.rows[0];
  if (!row) return { skip: "renewal_not_committed" };
  const recipient = channelRecipient(channel, {
    email: row.email,
    phone: row.phone,
    emailEligible: row.emailEligible,
    whatsappEligible: row.whatsappEligible
  });
  if (!recipient) return { skip: missingRecipientReason(channel) };
  if (channel === "evolution_whatsapp" && row.blocked) return { skip: "customer_blocked" };
  return {
    recipient,
    variables: {
      customer_name: row.customerName,
      plan_name: row.planName,
      store_name: row.storeName,
      old_expiry: dateValue(row.oldExpiry),
      new_expiry: dateValue(row.newExpiry),
      login_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://renvix.app"}/login`,
      support_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://renvix.app"}/support`
    }
  };
}

async function resolveDisconnectEvent(event, channel) {
  const channelId = event.payload_refs?.channelId || event.aggregate_id;
  const result = await query(
    `SELECT wc.id,wc.tenant_id AS "tenantId",wc.phone_number AS "disconnectedPhone",
            wc.disconnected_at AS "disconnectedAt",COALESCE(wc.last_error,'فصل مؤكد للقناة') AS reason,
            COALESCE(s.name,t.name,'Renvix') AS "customerName",s.support_phone AS "supportPhone",
            owner.email AS "ownerEmail"
       FROM whatsapp_channels wc
       JOIN tenants t ON t.id=wc.tenant_id
       LEFT JOIN LATERAL (
         SELECT name,support_phone FROM stores WHERE tenant_id=wc.tenant_id ORDER BY created_at LIMIT 1
       ) s ON true
       LEFT JOIN LATERAL (
         SELECT u.email FROM tenant_members tm JOIN users u ON u.id=tm.user_id
          WHERE tm.tenant_id=wc.tenant_id AND tm.role='owner' AND tm.status='active'
          ORDER BY tm.created_at LIMIT 1
       ) owner ON true
      WHERE wc.id=$1 AND wc.status='disconnected' AND wc.disconnected_at IS NOT NULL LIMIT 1`,
    [channelId]
  );
  const row = result.rows[0];
  if (!row) return { skip: "disconnect_not_confirmed" };
  const alternate = normalizeSubscriptionPhone(row.supportPhone);
  const disconnected = normalizeSubscriptionPhone(row.disconnectedPhone);
  const recipient = channelRecipient(channel, {
    email: row.ownerEmail,
    phone: alternate && alternate !== disconnected ? alternate : null
  });
  if (!recipient) return { skip: missingRecipientReason(channel) };
  return {
    recipient,
    variables: {
      customer_name: row.customerName,
      disconnected_phone: row.disconnectedPhone
        ? row.disconnectedPhone.replace(/(\+?\d{3})\d+(\d{4})$/, "$1 5* *** $2")
        : "",
      disconnect_reason: row.reason,
      disconnected_at: dateValue(row.disconnectedAt),
      reconnect_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://renvix.app"}/dashboard/devices`,
      support_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://renvix.app"}/support`
    }
  };
}

async function resolveSallaEvent(event, channel) {
  const connectionId = event.payload_refs?.connectionId || event.aggregate_id;
  const result = await query(
    `SELECT ac.id,ac.tenant_id AS "tenantId",ac.provider_store_name AS "storeName",
            ac.provider_store_domain AS "storeDomain",ac.ready_at AS "readyAt",
            u.name AS "customerName",u.email,s.support_phone AS "supportPhone"
       FROM app_connections ac
       JOIN LATERAL (
         SELECT u.name,u.email FROM tenant_members tm JOIN users u ON u.id=tm.user_id
          WHERE tm.tenant_id=ac.tenant_id AND tm.role='owner' AND tm.status='active'
          ORDER BY tm.created_at LIMIT 1
       ) u ON true
       LEFT JOIN LATERAL (
         SELECT support_phone FROM stores WHERE tenant_id=ac.tenant_id ORDER BY created_at LIMIT 1
       ) s ON true
      WHERE ac.id=$1 AND ac.provider='salla' AND ac.status='connected'
        AND ac.readiness_status='ready' AND ac.webhooks_registered_at IS NOT NULL
        AND ac.initial_sync_completed_at IS NOT NULL AND ac.ready_at IS NOT NULL
      LIMIT 1`,
    [connectionId]
  );
  const row = result.rows[0];
  if (!row) return { skip: "salla_integration_not_ready" };
  const recipient = channelRecipient(channel, { email: row.email, phone: row.supportPhone });
  if (!recipient) return { skip: missingRecipientReason(channel) };
  return {
    recipient,
    variables: {
      customer_name: row.customerName || "عميل Renvix",
      store_name: row.storeName,
      store_domain: row.storeDomain || "",
      connected_at: dateValue(row.readyAt),
      dashboard_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://renvix.app"}/dashboard`,
      integration_settings_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://renvix.app"}/dashboard/apps`,
      support_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://renvix.app"}/support`
    }
  };
}

async function resolveEvent(event, channel) {
  if (event.event_type === "account.provisioned") return resolveAccountEvent(event, channel);
  if (event.event_type === "subscription.renewed") return resolveRenewalEvent(event, channel);
  if (event.event_type === "channel.disconnected") return resolveDisconnectEvent(event, channel);
  if (event.event_type === "salla.integration.ready") return resolveSallaEvent(event, channel);
  return { skip: "unsupported_event" };
}

async function platformEvolutionInstance() {
  const result = await query(
    `SELECT external_channel_id AS "instanceName" FROM platform_messaging_channels
      WHERE provider='evolution' AND messaging_scope='platform_admin' AND status='connected'
        AND external_channel_id IS NOT NULL
      ORDER BY updated_at DESC LIMIT 1`
  );
  return result.rows[0]?.instanceName || process.env.EVOLUTION_ADMIN_INSTANCE || null;
}

export async function sendAdminTemplateTest({ templateKey, recipient, channel, values, adminUserId }) {
  const template = await loadTemplate(templateKey);
  if (!template) {
    const error = new Error("ADMIN_TEMPLATE_NOT_FOUND");
    error.code = error.message;
    throw error;
  }
  if (!template.isActive) {
    const error = new Error("ADMIN_TEMPLATE_DISABLED");
    error.code = error.message;
    throw error;
  }
  const deliveryChannel = channel || template.channel;
  const deliveryTemplate = { ...template, channel: deliveryChannel };
  const testValues = {
    ...values,
    ...(templateKey === ADMIN_TEMPLATE_KEYS.ACCOUNT_CREATED
      ? { temporary_password: "TEST-ONLY-NO-CREDENTIAL" } : {})
  };
  const rendered = renderAdminTemplate(deliveryTemplate, testValues);
  const masked = renderAdminTemplate(deliveryTemplate, testValues, { maskTemporaryPassword: true });
  const provider = deliveryChannel === "email" ? "resend" : "evolution";
  const idempotencyKey = `admin-template-test:${templateKey}:${crypto.randomUUID()}`;
  const reserved = await query(
    `INSERT INTO admin_outbound_messages
       (template_key,event_type,event_id,provider,channel,recipient_hash,recipient_encrypted,
        rendered_subject,rendered_body,status,idempotency_key,is_test_message,queued_at)
     VALUES ($1,'admin.template.test',$2,$3,$4,$5,$6,$7,$8,'processing',$9,true,now())
     RETURNING id`,
    [templateKey, String(adminUserId), provider, deliveryChannel,
      recipientHash(recipient), encryptedRecipient(recipient),
      masked.subject ? `[اختبار] ${masked.subject}` : null,
      `هذه رسالة اختبار من Renvix ولا تخص عملية فعلية.\n\n${masked.body}`,
      idempotencyKey]
  );
  const outboundId = reserved.rows[0].id;
  try {
    let response;
    const testBody = `هذه رسالة اختبار من Renvix ولا تخص عملية فعلية.\n\n${rendered.body}`;
    if (deliveryChannel === "email") {
      response = await sendQueuedEmail({
        to: recipient,
        subject: `[اختبار] ${rendered.subject || template.name}`,
        text: testBody,
        brandImageUrl: adminEmailLogoUrl(),
        tags: [
          { name: "template_key", value: templateKey },
          { name: "message_kind", value: "admin_test" }
        ]
      });
    } else {
      const instanceName = await platformEvolutionInstance();
      if (!instanceName) throw Object.assign(new Error("Platform Evolution Admin channel is not connected"), {
        code: "ADMIN_EVOLUTION_CHANNEL_MISSING"
      });
      response = await evolutionSendText(instanceName, recipient, testBody);
    }
    const providerMessageId = response?.key?.id || response?.data?.id || response?.id || null;
    await query(
      `UPDATE admin_outbound_messages SET status='accepted',provider_message_id=$2,
              attempts=1,accepted_at=now() WHERE id=$1`,
      [outboundId, providerMessageId]
    );
    return { outboundId, providerMessageId, status: "accepted" };
  } catch (error) {
    const failure = safeFailure(error);
    await query(
      `UPDATE admin_outbound_messages SET status='failed',attempts=1,failed_at=now(),
              failure_code=$2,failure_message_safe=$3 WHERE id=$1`,
      [outboundId, failure.code, failure.message]
    );
    throw error;
  }
}

async function markProvisioning(event, fields) {
  if (event.event_type !== "account.provisioned") return;
  const jobId = event.payload_refs?.provisioningJobId || event.aggregate_id;
  const values = [jobId, fields.status, fields.emailStatus, fields.messageId || null, fields.failureCode || null, fields.failureMessage || null];
  await query(
    `UPDATE account_provisioning_jobs
        SET status=$2,credentials_email_status=$3,credentials_email_id=COALESCE($4,credentials_email_id),
            credentials_email_sent_at=CASE WHEN $3='accepted' THEN now() ELSE credentials_email_sent_at END,
            failure_code=$5,failure_message=$6,updated_at=now()
      WHERE id=$1`,
    values
  );
}

async function sendEvent(event) {
  const templateKey = EVENT_TEMPLATE_MAP[event.event_type];
  const template = await loadTemplate(templateKey);
  if (!template) return { skip: "template_missing" };
  if (!template.isActive) return { skip: "template_disabled" };
  const resolved = await resolveEvent(event, template.channel);
  if (resolved.skip) return resolved;
  const rendered = renderAdminTemplate(template, resolved.variables);
  const masked = renderAdminTemplate(template, resolved.variables, { maskTemporaryPassword: true });
  const deliveryChannel = resolved.channel || template.channel;
  const provider = deliveryChannel === "email" ? "resend" : "evolution";
  const outboundKey = `${event.idempotency_key}:${template.version}`;
  const reserved = await query(
    `INSERT INTO admin_outbound_messages
       (template_key,event_type,event_id,provider,channel,recipient_hash,recipient_encrypted,
        rendered_subject,rendered_body,status,idempotency_key,queued_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'processing',$10,now())
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
    [templateKey, event.event_type, event.id, provider, deliveryChannel,
      recipientHash(resolved.recipient), encryptedRecipient(resolved.recipient),
      masked.subject, masked.body, outboundKey]
  );
  if (!reserved.rows[0]) return { duplicate: true };
  const outboundId = reserved.rows[0].id;
  try {
    let response;
    if (deliveryChannel === "email") {
      response = await sendQueuedEmail({
        to: resolved.recipient,
        subject: rendered.subject || template.name,
        text: rendered.body,
        brandImageUrl: adminEmailLogoUrl(),
        tags: [
          { name: "template_key", value: templateKey },
          { name: "event_id", value: String(event.id).slice(0, 256) }
        ]
      });
    } else {
      const instanceName = await platformEvolutionInstance();
      if (!instanceName) {
        const error = new Error("Platform Evolution Admin channel is not connected");
        error.code = "ADMIN_EVOLUTION_CHANNEL_MISSING";
        throw error;
      }
      response = await evolutionSendText(instanceName, resolved.recipient, rendered.body);
    }
    const providerMessageId = response?.key?.id || response?.data?.id || response?.id || null;
    await query(
      `UPDATE admin_outbound_messages SET status='accepted',provider_message_id=$2,
              attempts=attempts+1,accepted_at=now(),failure_code=NULL,failure_message_safe=NULL
        WHERE id=$1`,
      [outboundId, providerMessageId]
    );
    await markProvisioning(event, {
      status: "completed", emailStatus: "accepted", messageId: providerMessageId
    });
    return { accepted: true, outboundId, providerMessageId };
  } catch (error) {
    const failure = safeFailure(error);
    await query(
      `UPDATE admin_outbound_messages SET status='failed',attempts=attempts+1,failed_at=now(),
              failure_code=$2,failure_message_safe=$3 WHERE id=$1`,
      [outboundId, failure.code, failure.message]
    );
    await markProvisioning(event, {
      status: "email_failed", emailStatus: "failed",
      failureCode: failure.code, failureMessage: failure.message
    });
    throw error;
  }
}

export async function runAdminTemplateEventWorker({ limit = 20 } = {}) {
  const claimed = await transaction(async (client) => {
    const result = await client.query(
      `WITH candidates AS (
         SELECT id FROM admin_event_outbox
          WHERE status IN ('pending','failed') AND attempts < $1 AND available_at <= now()
          ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $2
       )
       UPDATE admin_event_outbox o
          SET status='processing',attempts=o.attempts+1,failure_code=NULL
         FROM candidates c WHERE o.id=c.id
       RETURNING o.*`,
      [MAX_ATTEMPTS, Math.min(100, Math.max(1, Number(limit) || 20))]
    );
    return result.rows;
  });
  const summary = { claimed: claimed.length, completed: 0, failed: 0, skipped: 0, duplicate: 0 };
  for (const event of claimed) {
    try {
      const result = await sendEvent(event);
      if (result.skip) {
        await query(
          `UPDATE admin_event_outbox SET status='skipped',processed_at=now(),failure_code=$2 WHERE id=$1`,
          [event.id, result.skip]
        );
        summary.skipped++;
      } else {
        await query(
          `UPDATE admin_event_outbox SET status='completed',processed_at=now(),failure_code=NULL WHERE id=$1`,
          [event.id]
        );
        if (result.duplicate) summary.duplicate++;
        summary.completed++;
      }
    } catch (error) {
      const failure = safeFailure(error);
      const terminal = Number(event.attempts || 0) >= MAX_ATTEMPTS
        || PERMANENT_FAILURE_CODES.has(failure.code);
      await query(
        `UPDATE admin_event_outbox
            SET status='failed',failure_code=$2,
                attempts=CASE WHEN $3 THEN $4 ELSE attempts END,
                available_at=CASE WHEN $3 THEN available_at
                  ELSE now() + (power(2,attempts)::text || ' minutes')::interval END
          WHERE id=$1`,
        [event.id, failure.code, terminal, MAX_ATTEMPTS]
      );
      summary.failed++;
    }
  }
  return summary;
}
