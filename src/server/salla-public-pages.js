import { appBaseUrl } from "./app-url.js";
import { query, transaction } from "./db.js";
import { decryptSecret, encryptSecret } from "../lib/encryption.js";
import { randomToken, sha256 } from "./security.js";

function encryptionKey() {
  const key = process.env.ORDER_LINK_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ORDER_LINK_ENCRYPTION_KEY or ENCRYPTION_KEY is required");
  return key;
}

function publicPageUrl(pageType, publicId, token) {
  const pathname = pageType === "invoice" ? `/i/${publicId}` : `/o/${publicId}`;
  const url = new URL(pathname, appBaseUrl());
  url.searchParams.set("t", token);
  return url.toString();
}

function safeSnapshot(pageType, source = {}) {
  const order = source.order || {};
  const invoice = source.invoice || {};
  const customer = source.customer || order.customer || {};
  const store = source.store || source.merchant || {};
  const items = Array.isArray(source.items) ? source.items : Array.isArray(order.items) ? order.items : [];
  const digitalDelivery = Array.isArray(source.digitalDelivery) ? source.digitalDelivery : [];
  return {
    pageType,
    store: {
      name: String(store.name || "").slice(0, 160),
      logoUrl: String(source.branding?.logoUrl || "").slice(0, 2000) || null
    },
    customer: {
      name: String(customer.name || [customer.first_name, customer.last_name].filter(Boolean).join(" ")).slice(0, 160)
    },
    order: {
      id: String(order.id || source.order_id || "").slice(0, 160),
      number: String(order.reference_id || source.reference_id || source.order_number || "").slice(0, 160),
      status: String(order.status?.name || source.status?.name || "").slice(0, 160),
      createdAt: order.created_at || source.created_at || null
    },
    invoice: pageType === "invoice" ? {
      id: String(invoice.id || source.invoice_id || "").slice(0, 160),
      number: String(invoice.number || source.number || "").slice(0, 160),
      date: invoice.date || source.created_at || null,
      currency: String(invoice.currency || source.currency || source.total?.currency || "SAR").slice(0, 12),
      subtotal: invoice.subtotal?.amount ?? source.subtotal?.amount ?? null,
      discounts: invoice.discounts?.amount ?? source.discount?.amount ?? null,
      tax: invoice.tax?.amount ?? source.tax?.amount ?? null,
      shipping: invoice.shipping?.amount ?? source.shipping?.amount ?? null,
      total: invoice.total?.amount ?? source.total?.amount ?? source.total ?? null,
      paymentMethod: String(invoice.payment_method || source.payment_method || "").slice(0, 160),
      paymentStatus: String(invoice.payment_status || source.payment_status || "").slice(0, 160)
    } : null,
    digital: pageType === "digital" ? {
      title: String(source.pageTitle || "منتجاتك الرقمية جاهزة").slice(0, 160),
      content: String(source.pageContent || "استخدم البيانات التالية للوصول إلى منتجك الرقمي بأمان.").slice(0, 5000),
      showDuration: source.showDuration === true,
      assets: digitalDelivery.slice(0, 100).map((asset) => ({
        orderItemId: String(asset.orderItemId || "").slice(0, 160),
        name: String(asset.name || "منتج رقمي").slice(0, 240),
        durationDays: Number(asset.durationDays || 0) || null,
        lifetime: asset.lifetime === true,
        startsAt: asset.startsAt || null,
        expiresAt: asset.expiresAt || null
      }))
    } : null,
    items: items.slice(0, 100).map((item) => ({
      name: String(item.name || item.product?.name || "").slice(0, 240),
      quantity: Number(item.quantity || 1),
      unitPrice: item.price?.amount ?? item.unit_price?.amount ?? item.price ?? null,
      total: item.total?.amount ?? item.total ?? null
    }))
  };
}

export async function getOrCreateSallaPublicPage({
  tenantId,
  storeId = null,
  templateId,
  pageType,
  externalEntityId,
  source,
  branding = {},
  expiresInDays = 365
}) {
  if (!["order", "invoice", "digital"].includes(pageType) || !externalEntityId) {
    return { ok: false, reason: "invalid_page_identity" };
  }
  return transaction(async (client) => {
    const lockKey = `salla-public-page:${tenantId}:${pageType}:${externalEntityId}`;
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lockKey]);
    const existing = await client.query(
      `SELECT id,public_id AS "publicId"
         FROM salla_public_pages
        WHERE tenant_id=$1 AND page_type=$2 AND external_entity_id=$3
          AND status='active' AND invalidated_at IS NULL
          AND (expires_at IS NULL OR expires_at>now())
        LIMIT 1 FOR UPDATE`,
      [tenantId, pageType, String(externalEntityId)]
    );
    if (existing.rows[0]) {
      // Rotate the raw token whenever a link is issued again. Only its hash is
      // persisted, so an old link cannot be recovered from the database.
      const token = randomToken(32);
      const securePayload = pageType === "digital"
        ? encryptSecret(JSON.stringify({ assets: Array.isArray(source?.digitalDelivery) ? source.digitalDelivery : [] }), encryptionKey())
        : null;
      await client.query(
        `UPDATE salla_public_pages SET payload_snapshot=$2::jsonb,branding=$3::jsonb,
             store_id=COALESCE($4,store_id),secure_payload_ciphertext=COALESCE($5,secure_payload_ciphertext),
             token_hash=$6,token_ciphertext=NULL,updated_at=now()
          WHERE id=$1`,
        [existing.rows[0].id, JSON.stringify(safeSnapshot(pageType, source)), JSON.stringify(branding || {}), storeId, securePayload, sha256(token)]
      );
      return {
        ok: true,
        created: false,
        id: existing.rows[0].id,
        url: publicPageUrl(pageType, existing.rows[0].publicId, token)
      };
    }
    const token = randomToken(32);
    const publicId = `${pageType === "invoice" ? "sinv" : pageType === "digital" ? "sdig" : "sord"}_${randomToken(16)}`;
    const days = Math.min(3650, Math.max(1, Number(expiresInDays) || 365));
    const inserted = await client.query(
      `INSERT INTO salla_public_pages (
         tenant_id,template_id,page_type,external_entity_id,public_id,token_hash,token_ciphertext,
         payload_snapshot,branding,expires_at,store_id,secure_payload_ciphertext,max_views
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,now()+($10::text||' days')::interval,$11,$12,$13)
       RETURNING id`,
      [
        tenantId,
        templateId,
        pageType,
        String(externalEntityId),
        publicId,
        sha256(token),
        null,
        JSON.stringify(safeSnapshot(pageType, source)),
        JSON.stringify(branding || {}),
        String(days),
        storeId,
        pageType === "digital"
          ? encryptSecret(JSON.stringify({ assets: Array.isArray(source?.digitalDelivery) ? source.digitalDelivery : [] }), encryptionKey())
          : null,
        Math.max(1, Math.min(10000, Number(source?.maxViews) || 100))
      ]
    );
    return {
      ok: true,
      created: true,
      id: inserted.rows[0].id,
      url: publicPageUrl(pageType, publicId, token)
    };
  });
}

export async function resolveSallaPublicPage(publicId, token) {
  if (!/^(sord|sinv|sdig)_[A-Za-z0-9_-]+$/.test(String(publicId || "")) || String(token || "").length < 32) {
    return { ok: false, reason: "invalid_link" };
  }
  const item = await transaction(async (client) => {
    const found = await client.query(
      `SELECT id,tenant_id AS "tenantId",store_id AS "storeId",page_type AS "pageType",
              external_entity_id AS "externalEntityId",payload_snapshot AS snapshot,
              secure_payload_ciphertext AS "securePayloadCiphertext",branding,status,
              expires_at AS "expiresAt",invalidated_at AS "invalidatedAt",revoked_at AS "revokedAt",
              max_views AS "maxViews",view_count AS "viewCount"
         FROM salla_public_pages
        WHERE public_id=$1 AND token_hash=$2 LIMIT 1 FOR UPDATE`,
      [String(publicId), sha256(token)]
    );
    const row = found.rows[0];
    if (!row || row.status !== "active" || row.invalidatedAt || row.revokedAt) return row;
    if (row.expiresAt && new Date(row.expiresAt) <= new Date()) return { ...row, expired: true };
    if (Number(row.viewCount || 0) >= Number(row.maxViews || 100)) return { ...row, viewLimitReached: true };
    await client.query(
      `UPDATE salla_public_pages SET view_count=view_count+1,first_viewed_at=COALESCE(first_viewed_at,now()),
         last_viewed_at=now(),updated_at=now() WHERE id=$1`,
      [row.id]
    );
    return row;
  });
  if (!item) return { ok: false, reason: "invalid_link" };
  if (item.revokedAt) return { ok: false, reason: "revoked" };
  if (item.status !== "active" || item.invalidatedAt) return { ok: false, reason: "invalid_link" };
  if (item.expired) return { ok: false, reason: "expired" };
  if (item.viewLimitReached) return { ok: false, reason: "view_limit_reached" };

  if (item.pageType === "digital" && item.securePayloadCiphertext) {
    try {
      const secure = JSON.parse(decryptSecret(item.securePayloadCiphertext, encryptionKey()));
      const metadata = Array.isArray(item.snapshot?.digital?.assets) ? item.snapshot.digital.assets : [];
      item.snapshot.digital.assets = (secure.assets || []).map((asset, index) => ({ ...metadata[index], ...asset }));
    } catch {
      return { ok: false, reason: "invalid_link" };
    }
  }

  let subscriptions = [];
  if (item.pageType === "order") {
    const result = await query(
      `SELECT cs.service_name AS "serviceName",sp.name AS "planName",cs.starts_at AS "startsAt",
              cs.expires_at AS "expiresAt",cs.status
         FROM customer_subscriptions cs
         LEFT JOIN subscription_plans sp ON sp.id=cs.plan_id
        WHERE cs.tenant_id=$1 AND cs.salla_order_id=$2
        ORDER BY cs.created_at`,
      [item.tenantId, item.externalEntityId]
    );
    subscriptions = result.rows.map((subscription) => ({
      ...subscription,
      remainingDays: Math.max(0, Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / 86_400_000))
    }));
  }
  return {
    ok: true,
    data: {
      pageType: item.pageType,
      externalEntityId: item.externalEntityId,
      snapshot: item.snapshot,
      branding: item.branding,
      expiresAt: item.expiresAt,
      subscriptions
    }
  };
}

export async function revokeSallaPublicPages({ tenantId, storeId, externalEntityId, reason }) {
  const result = await query(
    `UPDATE salla_public_pages SET status='invalidated',invalidated_at=now(),revoked_at=now(),
       revoke_reason=$4,updated_at=now()
     WHERE tenant_id=$1 AND ($2::text IS NULL OR store_id=$2) AND external_entity_id=$3
       AND status='active' RETURNING id`,
    [tenantId, storeId || null, String(externalEntityId), String(reason || "order_revoked").slice(0, 160)]
  );
  return result.rowCount;
}
