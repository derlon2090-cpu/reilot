import { createHash } from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizeContactEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return null;
  return email;
}

export function normalizeContactPhone(value, defaultCountry = "SA") {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  return parsed?.isValid() ? parsed.number : null;
}

export function maskDestination(value, channel) {
  const normalized = String(value || "");
  if (channel === "email") {
    const [local = "", domain = ""] = normalized.split("@");
    return `${local.slice(0, 2)}${local.length > 2 ? "***" : ""}@${domain}`;
  }
  return normalized.length > 7 ? `${normalized.slice(0, 4)}••••${normalized.slice(-3)}` : "••••";
}

export function destinationHash(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

export function sameOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function enforceActivityRateLimit(client, { tenantId, userId, action, limit = 30, interval = "1 minute" }) {
  const result = await client.query(
    `SELECT count(*)::int AS total
       FROM activity_logs
      WHERE tenant_id = $1 AND user_id = $2 AND type = $3
        AND created_at > now() - $4::interval`,
    [tenantId, userId, action, interval]
  );
  return Number(result.rows[0]?.total || 0) < limit;
}

export async function upsertCampaignContact(client, {
  tenantId, userId, displayName, email, phone, source = "manual", companyName = null,
  externalReference = null, sallaCustomerId = null, consentStatus = "unknown"
}) {
  const normalizedEmail = email ? normalizeContactEmail(email) : null;
  const normalizedPhone = phone ? normalizeContactPhone(phone) : null;
  if (email && !normalizedEmail) throw Object.assign(new Error("البريد الإلكتروني غير صالح."), { code: "invalid_email" });
  if (phone && !normalizedPhone) throw Object.assign(new Error("رقم الجوال غير صالح."), { code: "invalid_phone" });
  if (!displayName?.trim() && !normalizedEmail && !normalizedPhone) {
    throw Object.assign(new Error("أدخل الاسم أو وسيلة تواصل صالحة."), { code: "missing_identity" });
  }

  const matches = await client.query(
    `SELECT DISTINCT c.id, cp.channel
       FROM contacts c JOIN contact_points cp ON cp.contact_id = c.id AND cp.tenant_id = c.tenant_id
      WHERE c.tenant_id = $1
        AND (($2::text IS NOT NULL AND cp.channel = 'email' AND cp.normalized_value = $2)
          OR ($3::text IS NOT NULL AND cp.channel IN ('phone','whatsapp') AND cp.normalized_value = $3))`,
    [tenantId, normalizedEmail, normalizedPhone]
  );
  const ids = [...new Set(matches.rows.map((row) => row.id))];
  let contactId = ids[0] || null;
  const conflict = ids.length > 1;

  if (!contactId && sallaCustomerId) {
    const existing = await client.query(
      `SELECT id FROM contacts WHERE tenant_id = $1 AND salla_customer_id = $2 LIMIT 1`,
      [tenantId, String(sallaCustomerId)]
    );
    contactId = existing.rows[0]?.id || null;
  }

  if (!contactId) {
    const created = await client.query(
      `INSERT INTO contacts
         (tenant_id, display_name, company_name, source, external_reference, salla_customer_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [tenantId, String(displayName || normalizedEmail || normalizedPhone).trim(), companyName, source,
       externalReference, sallaCustomerId ? String(sallaCustomerId) : null, conflict ? "merge_review" : "active"]
    );
    contactId = created.rows[0].id;
  } else {
    await client.query(
      `UPDATE contacts SET display_name = COALESCE(NULLIF($3,''), display_name), company_name = COALESCE($4, company_name),
              salla_customer_id = COALESCE($5, salla_customer_id), status = CASE WHEN $6 THEN 'merge_review' ELSE status END,
              updated_at = now()
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, contactId, String(displayName || "").trim(), companyName,
       sallaCustomerId ? String(sallaCustomerId) : null, conflict]
    );
  }

  const points = [
    normalizedEmail && { channel: "email", value: normalizedEmail },
    normalizedPhone && { channel: "phone", value: normalizedPhone },
    normalizedPhone && { channel: "whatsapp", value: normalizedPhone }
  ].filter(Boolean);
  for (const point of points) {
    await client.query(
      `INSERT INTO contact_points
         (tenant_id, contact_id, channel, normalized_value, display_value, consent_status, is_primary, source)
       VALUES ($1,$2,$3,$4,$4,$5,true,$6)
       ON CONFLICT (tenant_id, channel, normalized_value) DO UPDATE
         SET updated_at = now(), display_value = EXCLUDED.display_value`,
      [tenantId, contactId, point.channel, point.value, consentStatus, source]
    );
  }
  await client.query(
    `INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata)
     VALUES ($1,$2,'contact.upserted','Campaign contact saved',$3::jsonb)`,
    [tenantId, userId, JSON.stringify({ contactId, source, conflict })]
  );
  return { contactId, conflict };
}

export function campaignDeliveryRate(campaign) {
  const sent = Number(campaign?.sentCount || campaign?.sent_count || 0);
  const delivered = Number(campaign?.deliveredCount || campaign?.delivered_count || 0);
  return sent > 0 ? Number(((delivered / sent) * 100).toFixed(1)) : 0;
}
