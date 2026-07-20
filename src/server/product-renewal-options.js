import { query, transaction } from "./db.js";
import { randomToken, sha256 } from "./security.js";
import {
  findRenewalCatalogProduct,
  parseRenewalOption,
  resolveStoredRenewalOption,
  safeRenewalUrl
} from "../lib/renewal-links.js";

function optionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    mappingId: row.mappingId,
    label: row.label,
    customerNote: row.customerNote,
    linkMode: row.linkMode,
    manualUrl: row.manualUrl,
    targetSallaProductId: row.targetSallaProductId,
    targetSallaVariantId: row.targetSallaVariantId,
    targetSallaSku: row.targetSallaSku,
    resolvedUrl: row.resolvedUrl,
    resolvedUrlSource: row.resolvedUrlSource,
    lastSyncedAt: row.lastSyncedAt,
    syncStatus: row.syncStatus,
    syncErrorCode: row.syncErrorCode,
    durationValue: Number(row.durationValue),
    durationUnit: row.durationUnit,
    showInPortal: row.showInPortal,
    showInWhatsapp: row.showInWhatsapp,
    showInEmail: row.showInEmail,
    sortOrder: Number(row.sortOrder),
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

const optionSelect = `SELECT id, product_mapping_id AS "mappingId", label,
  customer_note AS "customerNote", link_mode AS "linkMode", manual_url AS "manualUrl",
  target_salla_product_id AS "targetSallaProductId", target_salla_variant_id AS "targetSallaVariantId",
  target_salla_sku AS "targetSallaSku", resolved_url AS "resolvedUrl",
  resolved_url_source AS "resolvedUrlSource", last_synced_at AS "lastSyncedAt",
  sync_status AS "syncStatus", sync_error_code AS "syncErrorCode",
  duration_value AS "durationValue", duration_unit AS "durationUnit",
  show_in_portal AS "showInPortal", show_in_whatsapp AS "showInWhatsapp",
  show_in_email AS "showInEmail", sort_order AS "sortOrder", is_active AS "isActive",
  created_at AS "createdAt", updated_at AS "updatedAt"
  FROM product_renewal_options`;

export async function listRenewalOptions({ tenantId, mappingId, activeOnly = false }) {
  const result = await query(`${optionSelect}
    WHERE tenant_id=$1 AND product_mapping_id=$2 ${activeOnly ? "AND is_active=true" : ""}
    ORDER BY sort_order,label,created_at`, [tenantId, mappingId]);
  return result.rows.map(optionRow);
}

async function catalogRows(client, tenantId) {
  const result = await client.query(`SELECT salla_product_id AS "productId",salla_variant_id AS "variantId",
    sku,name,thumbnail_url AS "thumbnailUrl",customer_url AS "customerUrl",synced_at AS "lastSyncedAt",
    is_available AS "isAvailable" FROM salla_products WHERE tenant_id=$1`, [tenantId]);
  return result.rows;
}

export async function saveRenewalOption({ tenantId, mappingId, optionId = null, input }) {
  const parsed = parseRenewalOption(input);
  if (!parsed.ok) return { ok: false, reason: "invalid_renewal_option", issues: parsed.issues };
  return transaction(async (client) => {
    const mapping = await client.query("SELECT id FROM product_plan_mappings WHERE id=$1 AND tenant_id=$2 LIMIT 1", [mappingId, tenantId]);
    if (!mapping.rows[0]) return { ok: false, reason: "mapping_not_found" };
    const value = parsed.value;
    let resolvedUrl = value.manualUrl;
    let resolvedSource = value.linkMode === "manual" ? "manual" : null;
    let syncStatus = value.linkMode === "manual" ? "synced" : "unavailable";
    let syncErrorCode = null;
    if (value.linkMode === "automatic") {
      const catalog = await catalogRows(client, tenantId);
      const product = findRenewalCatalogProduct(catalog, value);
      if (!product) return { ok: false, reason: "salla_product_not_found" };
      resolvedUrl = safeRenewalUrl(product.customerUrl);
      resolvedSource = resolvedUrl ? "salla" : null;
      syncStatus = resolvedUrl ? "synced" : "unavailable";
      syncErrorCode = resolvedUrl ? null : "customer_url_missing";
    }
    const values = [tenantId, mappingId, value.label, value.customerNote, value.linkMode, value.manualUrl,
      value.targetSallaProductId, value.targetSallaVariantId, value.targetSallaSku, resolvedUrl, resolvedSource,
      syncStatus, syncErrorCode, value.durationValue, value.durationUnit, value.showInPortal,
      value.showInWhatsapp, value.showInEmail, value.sortOrder, value.isActive];
    const result = optionId
      ? await client.query(`UPDATE product_renewal_options SET label=$3,customer_note=$4,link_mode=$5,manual_url=$6,
          target_salla_product_id=$7,target_salla_variant_id=$8,target_salla_sku=$9,resolved_url=$10,
          resolved_url_source=$11,last_synced_at=CASE WHEN $10::text IS NULL THEN last_synced_at ELSE now() END,
          sync_status=$12,sync_error_code=$13,duration_value=$14,duration_unit=$15,show_in_portal=$16,
          show_in_whatsapp=$17,show_in_email=$18,sort_order=$19,is_active=$20,updated_at=now()
          WHERE id=$1 AND tenant_id=$2 AND product_mapping_id=$21 RETURNING *`,
          [optionId, tenantId, ...values.slice(2), mappingId])
      : await client.query(`INSERT INTO product_renewal_options
          (tenant_id,product_mapping_id,label,customer_note,link_mode,manual_url,target_salla_product_id,
           target_salla_variant_id,target_salla_sku,resolved_url,resolved_url_source,last_synced_at,sync_status,
           sync_error_code,duration_value,duration_unit,show_in_portal,show_in_whatsapp,show_in_email,sort_order,is_active)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CASE WHEN $10::text IS NULL THEN NULL ELSE now() END,$12,$13,$14,$15,$16,$17,$18,$19,$20)
          RETURNING id`, values);
    if (!result.rows[0]) return { ok: false, reason: "renewal_option_not_found" };
    const saved = await client.query(`${optionSelect} WHERE tenant_id=$1 AND id=$2`, [tenantId, result.rows[0].id]);
    return { ok: true, item: optionRow(saved.rows[0]) };
  });
}

export async function disableRenewalOption({ tenantId, mappingId, optionId }) {
  const result = await query(`UPDATE product_renewal_options SET is_active=false,updated_at=now()
    WHERE id=$1 AND tenant_id=$2 AND product_mapping_id=$3 RETURNING id`, [optionId, tenantId, mappingId]);
  return Boolean(result.rows[0]);
}

export async function syncAutomaticRenewalOptions(tenantId) {
  return transaction(async (client) => {
    const catalog = await catalogRows(client, tenantId);
    const options = await client.query(`${optionSelect} WHERE tenant_id=$1 AND link_mode='automatic' AND is_active=true`, [tenantId]);
    let synced = 0;
    let unavailable = 0;
    for (const raw of options.rows) {
      const item = optionRow(raw);
      const product = findRenewalCatalogProduct(catalog, item);
      const trustedUrl = safeRenewalUrl(product?.customerUrl);
      if (trustedUrl) {
        await client.query(`UPDATE product_renewal_options SET resolved_url=$3,resolved_url_source='salla',
          last_synced_at=now(),sync_status='synced',sync_error_code=NULL,updated_at=now()
          WHERE id=$1 AND tenant_id=$2`, [item.id, tenantId, trustedUrl]);
        synced += 1;
      } else {
        await client.query(`UPDATE product_renewal_options SET sync_status='unavailable',
          sync_error_code=$3,updated_at=now() WHERE id=$1 AND tenant_id=$2`,
          [item.id, tenantId, product ? "customer_url_missing" : "catalog_product_missing"]);
        unavailable += 1;
      }
    }
    return { synced, unavailable };
  });
}

export async function createRenewalRedirect({ tenantId, subscriptionId, optionId, expiresInDays = 30 }) {
  const token = randomToken(32);
  const hash = sha256(token);
  const days = Math.min(365, Math.max(1, Number(expiresInDays || 30)));
  const result = await query(`INSERT INTO renewal_redirect_links
    (tenant_id,subscription_id,renewal_option_id,token_hash,token_prefix,expires_at)
    SELECT $1,cs.id,pro.id,$4,$5,now()+($6||' days')::interval
    FROM customer_subscriptions cs
    JOIN product_plan_mappings ppm ON ppm.tenant_id=cs.tenant_id AND ppm.is_active=true
      AND ((cs.salla_variant_id IS NOT NULL AND ppm.salla_variant_id=cs.salla_variant_id)
        OR (ppm.salla_variant_id IS NULL AND ppm.salla_product_id=cs.salla_product_id))
    JOIN product_renewal_options pro ON pro.product_mapping_id=ppm.id AND pro.tenant_id=ppm.tenant_id
    WHERE cs.id=$2 AND cs.tenant_id=$1 AND pro.id=$3 AND pro.is_active=true
    RETURNING id`, [tenantId, subscriptionId, optionId, hash, token.slice(0, 8), String(days)]);
  if (!result.rows[0]) return { ok: false, reason: "renewal_option_not_available" };
  const base = String(process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return { ok: true, url: `${base}/r/${encodeURIComponent(token)}` };
}

export async function resolveRenewalRedirect(token) {
  const tokenHash = sha256(String(token || ""));
  return transaction(async (client) => {
    const result = await client.query(`SELECT rrl.id,rrl.tenant_id AS "tenantId",rrl.status,rrl.expires_at AS "expiresAt",
      pro.id AS "optionId",pro.is_active AS "isActive",pro.link_mode AS "linkMode",pro.manual_url AS "manualUrl",
      pro.target_salla_product_id AS "targetSallaProductId",pro.target_salla_variant_id AS "targetSallaVariantId",
      pro.target_salla_sku AS "targetSallaSku",pro.resolved_url AS "resolvedUrl",pro.last_synced_at AS "lastSyncedAt"
      FROM renewal_redirect_links rrl
      JOIN product_renewal_options pro ON pro.id=rrl.renewal_option_id AND pro.tenant_id=rrl.tenant_id
      WHERE rrl.token_hash=$1 LIMIT 1 FOR UPDATE OF rrl`, [tokenHash]);
    const item = result.rows[0];
    if (!item || item.status !== "active" || !item.isActive || (item.expiresAt && new Date(item.expiresAt) <= new Date())) {
      return { ok: false, reason: "invalid_or_expired_link" };
    }
    let product = null;
    if (item.linkMode === "automatic") {
      const catalog = await catalogRows(client, item.tenantId);
      product = findRenewalCatalogProduct(catalog, item);
    }
    const resolved = resolveStoredRenewalOption(item, product);
    if (!resolved.ok) return resolved;
    await client.query(`UPDATE renewal_redirect_links SET click_count=click_count+1,
      first_clicked_at=COALESCE(first_clicked_at,now()),last_clicked_at=now() WHERE id=$1`, [item.id]);
    return { ok: true, url: resolved.url };
  });
}
