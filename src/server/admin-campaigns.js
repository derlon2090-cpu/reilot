import crypto from "node:crypto";
import { decryptSecret, encryptSecret } from "../lib/encryption.js";
import { query, transaction } from "./db.js";
import { evolutionAdminAdapter } from "./admin-evolution-provider.js";
import { sendQueuedEmail } from "./email/resend.service.js";

const MAX_RECIPIENTS = 1000;
const MAX_ATTEMPTS = 3;

function campaignError(code, message = code) {
  return Object.assign(new Error(message), { code });
}

function normalizeRecipient(value, channel) {
  if (channel === "email") {
    const email = String(value || "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  }
  const phone = String(value || "").replace(/\D/g, "");
  return /^\d{8,15}$/.test(phone) ? phone : null;
}

function maskRecipient(value, channel) {
  if (channel === "email") {
    const [name, domain] = String(value).split("@");
    return `${name.slice(0, 2)}${"•".repeat(Math.max(3, Math.min(8, name.length - 2)))}@${domain}`;
  }
  return `+${value.slice(0, 4)}••••${value.slice(-3)}`;
}

export function normalizeAdminCampaignRecipients(input, channel) {
  const source = Array.isArray(input) ? input : String(input || "").split(/[\n,;]+/);
  const valid = [];
  const invalid = [];
  const seen = new Set();
  for (const item of source) {
    const raw = String(item || "").trim();
    if (!raw) continue;
    const normalized = normalizeRecipient(raw, channel);
    if (!normalized) {
      invalid.push(raw.slice(0, 120));
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      valid.push(normalized);
    }
  }
  return { valid, invalid };
}

function campaignSchedule(value) {
  if (!value) return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw campaignError("invalid_schedule", "موعد الإرسال غير صالح.");
  if (date.getTime() > Date.now() + 366 * 86400000) throw campaignError("schedule_too_far", "موعد الإرسال بعيد جدًا.");
  return date.getTime() < Date.now() ? new Date() : date;
}

export async function createAdminCampaign(input, adminUserId) {
  const name = String(input?.name || "").trim();
  const channel = input?.channel === "email" ? "email" : "evolution_whatsapp";
  const subject = channel === "email" ? String(input?.subject || "").trim() : null;
  const body = String(input?.body || "").trim();
  if (name.length < 3 || name.length > 120) throw campaignError("invalid_name", "أدخل اسم حملة من 3 إلى 120 حرفًا.");
  if (body.length < 2 || body.length > 10000) throw campaignError("invalid_body", "محتوى الحملة غير صالح.");
  if (channel === "email" && (subject.length < 2 || subject.length > 200)) throw campaignError("invalid_subject", "عنوان البريد مطلوب.");
  const recipients = normalizeAdminCampaignRecipients(input?.recipients, channel);
  if (recipients.invalid.length) throw campaignError("invalid_recipients", `تعذر التحقق من ${recipients.invalid.length} مستلم.`);
  if (!recipients.valid.length) throw campaignError("recipients_required", "أضف مستلمًا واحدًا على الأقل.");
  if (recipients.valid.length > MAX_RECIPIENTS) throw campaignError("recipients_limit", `الحد الأقصى ${MAX_RECIPIENTS} مستلم في الحملة.`);
  if (!process.env.ENCRYPTION_KEY) throw campaignError("encryption_not_configured", "تشفير بيانات المستلمين غير مهيأ.");
  const scheduledFor = campaignSchedule(input?.scheduledFor);

  return transaction(async (client) => {
    const campaign = await client.query(
      `INSERT INTO admin_campaigns
         (created_by_admin_user_id,name,channel,subject,body,status,total_recipients,scheduled_for)
       VALUES ($1,$2,$3,$4,$5,'queued',$6,$7)
       RETURNING id,name,channel,status,total_recipients AS "totalRecipients",scheduled_for AS "scheduledFor",created_at AS "createdAt"`,
      [adminUserId, name, channel, subject, body, recipients.valid.length, scheduledFor]
    );
    for (const recipient of recipients.valid) {
      await client.query(
        `INSERT INTO admin_campaign_recipients
           (campaign_id,recipient_hash,recipient_encrypted,recipient_masked,status,available_at)
         VALUES ($1,$2,$3,$4,'pending',$5)`,
        [campaign.rows[0].id, crypto.createHash("sha256").update(recipient).digest("hex"),
          encryptSecret(recipient, process.env.ENCRYPTION_KEY), maskRecipient(recipient, channel), scheduledFor]
      );
    }
    return campaign.rows[0];
  });
}

export async function listAdminCampaigns({ limit = 50 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const [campaigns, channel] = await Promise.all([
    query(
      `SELECT c.id,c.name,c.channel,c.subject,c.status,c.total_recipients AS "totalRecipients",
              c.sent_count AS "sentCount",c.failed_count AS "failedCount",c.scheduled_for AS "scheduledFor",
              c.created_at AS "createdAt",u.name AS "adminName"
         FROM admin_campaigns c
         JOIN admin_users au ON au.id=c.created_by_admin_user_id
         JOIN users u ON u.id=au.user_id
        ORDER BY c.created_at DESC LIMIT $1`,
      [safeLimit]
    ),
    query(
      `SELECT id,display_name AS "displayName",phone_masked AS "phoneMasked",status
         FROM platform_messaging_channels
        WHERE provider='evolution_admin' AND messaging_scope='platform_admin'
        ORDER BY (status='connected') DESC,updated_at DESC LIMIT 1`
    )
  ]);
  return {
    campaigns: campaigns.rows,
    whatsappDevice: channel.rows[0] || null,
    whatsappReady: channel.rows[0]?.status === "connected"
  };
}

async function connectedAdminInstance() {
  const result = await query(
    `SELECT external_channel_id AS "instanceName"
       FROM platform_messaging_channels
      WHERE provider='evolution_admin' AND messaging_scope='platform_admin' AND status='connected'
        AND external_channel_id IS NOT NULL
      ORDER BY updated_at DESC LIMIT 1`
  );
  return result.rows[0]?.instanceName || null;
}

async function refreshCampaign(campaignId) {
  await query(
    `WITH totals AS (
       SELECT campaign_id,
              count(*) FILTER (WHERE status='sent')::int AS sent,
              count(*) FILTER (WHERE status='failed' AND attempts >= $2)::int AS failed,
              count(*) FILTER (WHERE status IN ('pending','processing') OR (status='failed' AND attempts < $2))::int AS active
         FROM admin_campaign_recipients WHERE campaign_id=$1 GROUP BY campaign_id
     )
     UPDATE admin_campaigns c
        SET sent_count=t.sent,failed_count=t.failed,
            status=CASE WHEN t.active>0 THEN 'processing' WHEN t.sent=c.total_recipients THEN 'completed'
                        WHEN t.sent>0 THEN 'partial' ELSE 'failed' END,
            completed_at=CASE WHEN t.active=0 THEN now() ELSE NULL END,updated_at=now()
       FROM totals t WHERE c.id=t.campaign_id`,
    [campaignId, MAX_ATTEMPTS]
  );
}

function safeFailure(error) {
  return String(error?.code || "admin_campaign_send_failed").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

export async function runAdminCampaignWorker({ limit = 40, campaignId = null } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 40));
  const claimed = await transaction(async (client) => {
    const result = await client.query(
      `WITH candidates AS (
         SELECT r.id
           FROM admin_campaign_recipients r JOIN admin_campaigns c ON c.id=r.campaign_id
          WHERE c.status IN ('queued','processing') AND c.scheduled_for<=now()
            AND r.status IN ('pending','failed') AND r.attempts<$1 AND r.available_at<=now()
            AND ($3::uuid IS NULL OR c.id=$3::uuid)
          ORDER BY r.created_at FOR UPDATE OF r SKIP LOCKED LIMIT $2
       )
       UPDATE admin_campaign_recipients r
          SET status='processing',attempts=r.attempts+1,updated_at=now()
         FROM candidates x,admin_campaigns c
        WHERE r.id=x.id AND c.id=r.campaign_id
       RETURNING r.id,r.campaign_id AS "campaignId",r.recipient_encrypted AS "recipientEncrypted",
                 r.attempts,c.channel,c.subject,c.body`,
      [MAX_ATTEMPTS, safeLimit, campaignId]
    );
    if (result.rows.length) {
      await client.query(
        `UPDATE admin_campaigns SET status='processing',started_at=COALESCE(started_at,now()),updated_at=now()
          WHERE id=ANY($1::uuid[])`,
        [[...new Set(result.rows.map((row) => row.campaignId))]]
      );
    }
    return result.rows;
  });

  const summary = { claimed: claimed.length, sent: 0, failed: 0 };
  let instanceName;
  for (const item of claimed) {
    try {
      const recipient = decryptSecret(item.recipientEncrypted, process.env.ENCRYPTION_KEY);
      let response;
      if (item.channel === "email") {
        response = await sendQueuedEmail({
          to: recipient,
          subject: item.subject,
          text: item.body,
          tags: [{ name: "message_kind", value: "admin_campaign" }, { name: "campaign_id", value: item.campaignId }]
        });
      } else {
        instanceName ||= await connectedAdminInstance();
        if (!instanceName) throw campaignError("admin_device_not_connected");
        response = await evolutionAdminAdapter.sendTextMessage({ instanceName, to: recipient, text: item.body });
      }
      const messageId = response?.key?.id || response?.data?.id || response?.id || null;
      await query("UPDATE admin_campaign_recipients SET status='sent',provider_message_id=$2,failure_code=NULL,sent_at=now(),updated_at=now() WHERE id=$1", [item.id, messageId]);
      summary.sent++;
    } catch (error) {
      const terminal = Number(item.attempts) >= MAX_ATTEMPTS;
      await query(
        `UPDATE admin_campaign_recipients
            SET status='failed',failure_code=$2,available_at=CASE WHEN $3 THEN available_at ELSE now()+(power(2,attempts)::text||' minutes')::interval END,updated_at=now()
          WHERE id=$1`,
        [item.id, safeFailure(error), terminal]
      );
      summary.failed++;
    }
    await refreshCampaign(item.campaignId);
  }
  return summary;
}
