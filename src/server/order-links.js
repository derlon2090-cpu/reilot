import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { randomToken, sha256 } from "./security.js";
import {
  DEFAULT_VISIBLE_FIELDS,
  normalizeAdditionalNotes,
  normalizeOrderLinkColor,
  normalizeOrderLinkStyle,
  normalizeOrderSlug,
  normalizeVisibleFields,
  remainingSubscriptionDays,
  validateOrderSlug
} from "../lib/orderLinks.js";

const orderLinkIpSalt = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

function profileRow(row) {
  if (!row) return null;
  return {
    ...row,
    defaultTemplateStyle: normalizeOrderLinkStyle(row.defaultTemplateStyle),
    defaultThemeColor: normalizeOrderLinkColor(row.defaultThemeColor)
  };
}

export async function ensureOrderLinkProfile(tenantId) {
  const existing = await query(
    `SELECT id, tenant_id AS "tenantId", store_name AS "storeName", slug, logo_url AS "logoUrl",
            default_template_style AS "defaultTemplateStyle", default_theme_color AS "defaultThemeColor",
            is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM order_link_profiles WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  if (existing.rows[0]) return profileRow(existing.rows[0]);

  const source = await query(
    `SELECT COALESCE(s.name, t.name, 'Store') AS "storeName", t.slug
       FROM tenants t LEFT JOIN LATERAL (
         SELECT name FROM stores WHERE tenant_id = t.id ORDER BY created_at LIMIT 1
       ) s ON true
      WHERE t.id = $1 LIMIT 1`,
    [tenantId]
  );
  const storeName = source.rows[0]?.storeName || "Store";
  const baseCandidate = validateOrderSlug(source.rows[0]?.slug || "");
  const base = baseCandidate.ok ? baseCandidate.slug : normalizeOrderSlug(storeName) || "store";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slugCandidate = `${base.slice(0, 48)}-${crypto.randomBytes(2).toString("hex")}`;
    try {
      const created = await query(
        `INSERT INTO order_link_profiles (tenant_id, store_name, slug)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id) DO UPDATE SET updated_at = order_link_profiles.updated_at
         RETURNING id, tenant_id AS "tenantId", store_name AS "storeName", slug, logo_url AS "logoUrl",
                   default_template_style AS "defaultTemplateStyle", default_theme_color AS "defaultThemeColor",
                   is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [tenantId, storeName, slugCandidate]
      );
      return profileRow(created.rows[0]);
    } catch (error) {
      if (error?.code !== "23505") throw error;
    }
  }
  throw new Error("Unable to allocate a unique store slug");
}

export async function saveOrderLinkProfile({ tenantId, storeName, slug, logoUrl, defaultTemplateStyle, defaultThemeColor, isActive = true }) {
  const slugResult = validateOrderSlug(slug);
  if (!slugResult.ok) return { ok: false, reason: slugResult.reason };
  const name = String(storeName || "").trim().slice(0, 120);
  if (name.length < 2) return { ok: false, reason: "invalid_store_name" };
  try {
    const saved = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO order_link_profiles (
           tenant_id, store_name, slug, logo_url, default_template_style, default_theme_color, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tenant_id) DO UPDATE SET
           store_name = EXCLUDED.store_name, slug = EXCLUDED.slug, logo_url = EXCLUDED.logo_url,
           default_template_style = EXCLUDED.default_template_style,
           default_theme_color = EXCLUDED.default_theme_color, is_active = EXCLUDED.is_active, updated_at = now()
         RETURNING id, tenant_id AS "tenantId", store_name AS "storeName", slug, logo_url AS "logoUrl",
                   default_template_style AS "defaultTemplateStyle", default_theme_color AS "defaultThemeColor",
                   is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [tenantId, name, slugResult.slug, logoUrl || null, normalizeOrderLinkStyle(defaultTemplateStyle), normalizeOrderLinkColor(defaultThemeColor), Boolean(isActive)]
      );
      const baseUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
      await client.query(
        `UPDATE order_template_links
            SET public_url = $2 || '/o/' || $3 ||
                CASE WHEN position('?' in public_url) > 0 THEN substring(public_url from position('?' in public_url)) ELSE '' END,
                updated_at = now()
          WHERE tenant_id = $1`,
        [tenantId, baseUrl, slugResult.slug]
      );
      await client.query(
        `UPDATE order_info_links l
            SET public_url = tl.public_url, updated_at = now()
           FROM order_template_links tl
          WHERE l.template_link_id = tl.id AND tl.tenant_id = $1`,
        [tenantId]
      );
      return result.rows[0];
    });
    return { ok: true, profile: profileRow(saved) };
  } catch (error) {
    if (error?.code === "23505") return { ok: false, reason: "slug_exists" };
    throw error;
  }
}

export async function ensureTemplatePublicLink({ tenantId, templateId, expiresInDays = null }) {
  const profile = await ensureOrderLinkProfile(tenantId);
  return transaction(async (client) => {
    const template = await client.query(
      "SELECT id FROM order_info_templates WHERE id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1",
      [templateId, tenantId]
    );
    if (!template.rows[0]) return { ok: false, reason: "template_not_found" };

    const existing = await client.query(
      `SELECT id, public_url AS "publicUrl", status, expires_at AS "expiresAt",
              opened_count AS "openedCount", created_at AS "createdAt"
         FROM order_template_links
        WHERE template_id = $1 AND tenant_id = $2
        LIMIT 1`,
      [templateId, tenantId]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].status === "active" && (!existing.rows[0].expiresAt || new Date(existing.rows[0].expiresAt) > new Date())) {
        return { ok: true, item: existing.rows[0] };
      }
      const restored = await client.query(
        `UPDATE order_template_links
            SET status = 'active', expires_at = NULL, updated_at = now()
          WHERE id = $1 AND tenant_id = $2
          RETURNING id, public_url AS "publicUrl", status, expires_at AS "expiresAt",
                    opened_count AS "openedCount", created_at AS "createdAt"`,
        [existing.rows[0].id, tenantId]
      );
      return { ok: true, item: restored.rows[0] };
    }

    const publicToken = randomToken(12);
    const baseUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
    const publicUrl = `${baseUrl}/o/${encodeURIComponent(profile.slug)}?t=${encodeURIComponent(publicToken)}`;
    const days = expiresInDays == null ? null : Math.min(3650, Math.max(1, Number(expiresInDays || 30)));
    const inserted = await client.query(
      `INSERT INTO order_template_links (
         tenant_id, template_id, public_token, public_url, expires_at
       ) VALUES ($1, $2, $3, $4, CASE WHEN $5::text IS NULL THEN NULL ELSE now() + ($5 || ' days')::interval END)
       ON CONFLICT (template_id) DO UPDATE SET updated_at = order_template_links.updated_at
       RETURNING id, public_url AS "publicUrl", status, expires_at AS "expiresAt",
                 opened_count AS "openedCount", created_at AS "createdAt"`,
      [tenantId, templateId, sha256(publicToken), publicUrl, days == null ? null : String(days)]
    );
    return { ok: true, item: inserted.rows[0] };
  });
}

export function normalizedTemplateInput(body = {}) {
  const name = String(body.name || "").trim().slice(0, 120);
  const storeName = String(body.storeName || "").trim().slice(0, 120);
  if (name.length < 2 || storeName.length < 2) return { ok: false, reason: "missing_fields" };
  return {
    ok: true,
    value: {
      name,
      storeName,
      style: normalizeOrderLinkStyle(body.style),
      themeColor: normalizeOrderLinkColor(body.themeColor),
      headerText: String(body.headerText || "").trim().slice(0, 300) || null,
      footerText: String(body.footerText || "").trim().slice(0, 300) || null,
      additionalNotes: normalizeAdditionalNotes(body.additionalNotes),
      visibleFields: normalizeVisibleFields(body.visibleFields),
      isDefault: Boolean(body.isDefault),
      isActive: body.isActive !== false
    }
  };
}

export async function createOrderInfoLink({
  tenantId,
  userId,
  subscriptionId,
  templateId,
  expiresInDays = 30,
  sendMethod = "copy",
  source = "manual",
  externalOrderId = null
}) {
  if (!templateId) return { ok: false, reason: "template_required" };
  const stableTemplateLink = await ensureTemplatePublicLink({ tenantId, templateId, expiresInDays: null });
  if (!stableTemplateLink.ok) return stableTemplateLink;
  const result = await transaction(async (client) => {
    const subscription = await client.query(
      `SELECT s.id, s.order_number AS "orderNumber", s.customer_id AS "customerId"
         FROM subscriptions s
        WHERE s.id = $1 AND s.tenant_id = $2 LIMIT 1`,
      [subscriptionId, tenantId]
    );
    if (!subscription.rows[0]) return { ok: false, reason: "subscription_not_found" };
    const template = await client.query("SELECT id FROM order_info_templates WHERE id = $1 AND tenant_id = $2 AND is_active = true", [templateId, tenantId]);
    if (!template.rows[0]) return { ok: false, reason: "template_not_found" };
    const orderNumber = subscription.rows[0].orderNumber;
    const days = Math.min(365, Math.max(1, Number(expiresInDays || 30)));
    const inserted = await client.query(
      `INSERT INTO order_info_links (
         tenant_id, template_id, template_link_id, subscription_id, customer_id, order_number,
         public_token, public_url, send_method, expires_at, source, external_order_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() + ($10 || ' days')::interval, $11, $12)
       ON CONFLICT (tenant_id, subscription_id) DO UPDATE SET
         template_id = EXCLUDED.template_id,
         template_link_id = EXCLUDED.template_link_id,
         customer_id = EXCLUDED.customer_id,
         order_number = EXCLUDED.order_number,
         public_url = EXCLUDED.public_url,
         send_method = EXCLUDED.send_method,
         source = EXCLUDED.source,
         external_order_id = COALESCE(EXCLUDED.external_order_id, order_info_links.external_order_id),
         status = 'active',
         expires_at = EXCLUDED.expires_at,
         updated_at = now()
       RETURNING id, order_number AS "orderNumber", status,
                 expires_at AS "expiresAt", created_at AS "createdAt"`,
      [tenantId, templateId, stableTemplateLink.item.id, subscriptionId, subscription.rows[0].customerId, orderNumber,
        sha256(randomToken(12)), stableTemplateLink.item.publicUrl,
        ["copy", "whatsapp", "email"].includes(sendMethod) ? sendMethod : "copy", String(days),
        source === "salla" ? "salla" : "manual", externalOrderId || null]
    );
    await client.query(
      "INSERT INTO order_link_events (tenant_id, order_info_link_id, event_type) VALUES ($1, $2, 'created')",
      [tenantId, inserted.rows[0].id]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, customer_id, type, title, metadata)
       VALUES ($1, $2, $3, 'order_link.created', 'Order information link created', $4::jsonb)`,
      [tenantId, userId, subscription.rows[0].customerId, JSON.stringify({ linkId: inserted.rows[0].id, subscriptionId, orderNumber })]
    );
    return { ok: true, item: inserted.rows[0] };
  });
  if (!result.ok) return result;
  return { ok: true, item: { ...result.item, publicUrl: stableTemplateLink.item.publicUrl, templateLinkId: stableTemplateLink.item.id } };
}

export function hashOrderLinkIp(req) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip") || "";
  if (!ip) return null;
  return sha256(`${orderLinkIpSalt}:${ip}`);
}

export function publicOrderPayload(row) {
  const visible = normalizeVisibleFields(row.visibleFields || DEFAULT_VISIBLE_FIELDS);
  const remaining = remainingSubscriptionDays(row.endDate);
  return {
    store: {
      name: row.storeName,
      slug: row.storeSlug,
      logoUrl: row.logoUrl || null,
      supportPhone: row.supportPhone || null
    },
    order: {
      orderNumber: row.orderNumber,
      customerName: visible.customerName ? row.customerName : null,
      maskedPhone: visible.phoneNumber ? row.maskedPhone : null,
      planName: visible.planName ? row.planName : null,
      serviceName: row.serviceName,
      status: visible.status ? row.subscriptionStatus : null,
      startDate: visible.startDate ? row.startDate : null,
      endDate: visible.endDate ? row.endDate : null,
      remaining: visible.remainingDays ? remaining : null
    },
    template: {
      name: row.templateName,
      style: normalizeOrderLinkStyle(row.templateStyle),
      themeColor: normalizeOrderLinkColor(row.themeColor),
      headerText: row.headerText || null,
      footerText: row.footerText || null,
      additionalNotes: visible.additionalNotes ? normalizeAdditionalNotes(row.additionalNotes) : [],
      visibleFields: visible
    },
    renewalOptions: Array.isArray(row.renewalOptions) ? row.renewalOptions.map((item) => ({
      id: item.id,
      label: item.label,
      note: item.note || null,
      durationValue: Number(item.durationValue),
      durationUnit: item.durationUnit,
      url: item.url
    })) : []
  };
}
