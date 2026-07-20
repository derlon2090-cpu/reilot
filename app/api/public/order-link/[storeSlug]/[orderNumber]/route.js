import { maskPublicPhone } from "../../../../../../src/lib/orderLinks.js";
import { query, transaction } from "../../../../../../src/server/db.js";
import { hashOrderLinkIp, publicOrderPayload } from "../../../../../../src/server/order-links.js";
import { sha256 } from "../../../../../../src/server/security.js";
import { createRenewalRedirect } from "../../../../../../src/server/product-renewal-options.js";

function noStore(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Cache-Control", "no-store, private, max-age=0");
  return Response.json(body, { ...init, headers });
}

export async function GET(req, { params }) {
  const { storeSlug, orderNumber } = await params;
  const token = new URL(req.url).searchParams.get("t") || "";
  if (!token || token.length < 8) return noStore({ ok: false, reason: "invalid_link", message: "لم يتم العثور على الطلب أو الرابط غير صالح." }, { status: 404 });
  const result = await query(
    `SELECT l.id, l.tenant_id AS "tenantId", l.status AS "orderStatus", l.expires_at AS "orderExpiresAt",
            tl.id AS "templateLinkId", tl.status AS "linkStatus", tl.expires_at AS "expiresAt",
            l.order_number AS "orderNumber", p.store_name AS "storeName", p.slug AS "storeSlug",
            p.logo_url AS "logoUrl", st.support_phone AS "supportPhone",
            s.id AS "legacySubscriptionId", s.plan_name AS "planName", s.service_name AS "serviceName",
            s.start_date AS "startDate", s.end_date AS "endDate", s.status AS "subscriptionStatus",
            c.name AS "customerName", COALESCE(c.whatsapp_number, c.phone) AS "phoneNumber",
            t.name AS "templateName", COALESCE(t.style, p.default_template_style) AS "templateStyle",
            COALESCE(t.theme_color, p.default_theme_color) AS "themeColor",
            t.header_text AS "headerText", t.footer_text AS "footerText",
            COALESCE(t.additional_notes, '[]'::jsonb) AS "additionalNotes",
            COALESCE(t.visible_fields, '{}'::jsonb) AS "visibleFields"
       FROM order_template_links tl
       JOIN order_link_profiles p ON p.tenant_id = tl.tenant_id AND p.is_active = true
       JOIN order_info_templates t ON t.id = tl.template_id AND t.tenant_id = tl.tenant_id AND t.is_active = true
       JOIN order_info_links l ON l.template_link_id = tl.id AND l.tenant_id = tl.tenant_id
       JOIN subscriptions s ON s.id = l.subscription_id AND s.tenant_id = l.tenant_id
       LEFT JOIN customers c ON c.id = l.customer_id AND c.tenant_id = l.tenant_id
       LEFT JOIN LATERAL (
         SELECT support_phone FROM stores WHERE tenant_id = l.tenant_id ORDER BY created_at LIMIT 1
       ) st ON true
      WHERE lower(p.slug) = lower($1) AND l.order_number = $2 AND tl.public_token = $3
      LIMIT 1`,
    [storeSlug, orderNumber, sha256(token)]
  );
  const row = result.rows[0];
  if (!row) return noStore({ ok: false, reason: "invalid_link", message: "لم يتم العثور على الطلب أو الرابط غير صالح." }, { status: 404 });
  if (row.linkStatus !== "active") {
    return noStore({ ok: false, reason: row.linkStatus, message: "هذا الرابط غير متاح حاليًا. تواصل مع المتجر للحصول على رابط جديد." }, { status: 410 });
  }
  if (row.orderStatus !== "active") {
    return noStore({ ok: false, reason: row.orderStatus, message: "هذا الطلب غير متاح حاليًا عبر رابط المتجر." }, { status: 410 });
  }
  if (row.expiresAt && new Date(row.expiresAt) <= new Date()) {
    await transaction(async (client) => {
      await client.query("UPDATE order_template_links SET status = 'expired', updated_at = now() WHERE id = $1 AND status = 'active'", [row.templateLinkId]);
      await client.query("INSERT INTO order_link_events (tenant_id, order_info_link_id, event_type) VALUES ($1, $2, 'expired')", [row.tenantId, row.id]);
    });
    return noStore({ ok: false, reason: "expired", message: "انتهت صلاحية هذا الرابط. تواصل مع المتجر للحصول على رابط جديد." }, { status: 410 });
  }
  if (row.orderExpiresAt && new Date(row.orderExpiresAt) <= new Date()) {
    await transaction(async (client) => {
      await client.query("UPDATE order_info_links SET status = 'expired', updated_at = now() WHERE id = $1 AND status = 'active'", [row.id]);
      await client.query("INSERT INTO order_link_events (tenant_id, order_info_link_id, event_type) VALUES ($1, $2, 'expired')", [row.tenantId, row.id]);
    });
    return noStore({ ok: false, reason: "expired", message: "انتهت صلاحية معلومات هذا الطلب. تواصل مع المتجر لتحديثها." }, { status: 410 });
  }
  row.maskedPhone = maskPublicPhone(row.phoneNumber);
  const renewalResult = await query(`SELECT cs.id AS "subscriptionId",pro.id,pro.label,
    pro.customer_note AS note,pro.duration_value AS "durationValue",pro.duration_unit AS "durationUnit"
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
      AND pro.is_active=true AND pro.show_in_portal=true
      AND ((pro.link_mode='manual' AND pro.manual_url IS NOT NULL)
        OR (pro.link_mode='automatic' AND pro.resolved_url IS NOT NULL))
    WHERE cs.tenant_id=$1 AND cs.legacy_subscription_id=$2
    ORDER BY pro.sort_order,pro.created_at`, [row.tenantId, row.legacySubscriptionId]);
  row.renewalOptions = [];
  for (const item of renewalResult.rows) {
    const link = await createRenewalRedirect({ tenantId: row.tenantId, subscriptionId: item.subscriptionId, optionId: item.id });
    if (link.ok) row.renewalOptions.push({ ...item, url: link.url });
  }
  const checked = new URL(req.url).searchParams.get("checked") === "1";
  await transaction(async (client) => {
    await client.query(
      `UPDATE order_info_links SET opened_count = opened_count + 1, last_opened_at = now(), updated_at = now()
        WHERE id = $1`,
      [row.id]
    );
    await client.query(
      `UPDATE order_template_links SET opened_count = opened_count + 1, last_opened_at = now(), updated_at = now()
        WHERE id = $1`,
      [row.templateLinkId]
    );
    await client.query(
      `INSERT INTO order_link_events (tenant_id, order_info_link_id, event_type, ip_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.tenantId, row.id, checked ? "order_checked" : "opened", hashOrderLinkIp(req), String(req.headers.get("user-agent") || "").slice(0, 500) || null]
    );
  });
  return noStore({ ok: true, data: publicOrderPayload(row) });
}
