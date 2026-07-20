import { maskPublicPhone } from "../../../../../src/lib/orderLinks.js";
import { calculateRemainingTime, durationLabel } from "../../../../../src/lib/subscription-time.js";
import { query } from "../../../../../src/server/db.js";
import { resolveOrderPortalLink } from "../../../../../src/server/order-portal-links.js";
import { createRenewalRedirect } from "../../../../../src/server/product-renewal-options.js";

function response(body, status = 200) {
  return Response.json(body, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    "Pragma": "no-cache",
    "X-Robots-Tag": "noindex, nofollow, noarchive"
  } });
}

async function renewalOptions(tenantId, subscriptionId) {
  const result = await query(`SELECT pro.id,pro.label,pro.customer_note AS note,
    pro.duration_value AS "durationValue",pro.duration_unit AS "durationUnit"
    FROM customer_subscriptions cs
    JOIN LATERAL (SELECT ppm.id FROM product_plan_mappings ppm
      WHERE ppm.tenant_id=cs.tenant_id AND ppm.is_active=true
        AND ((cs.salla_variant_id IS NOT NULL AND ppm.salla_variant_id=cs.salla_variant_id)
          OR (ppm.salla_variant_id IS NULL AND ppm.salla_product_id=cs.salla_product_id)
          OR (ppm.salla_product_sku IS NOT NULL AND ppm.salla_product_sku=(SELECT sku FROM salla_products
              WHERE tenant_id=cs.tenant_id AND salla_product_id=cs.salla_product_id
                AND (cs.salla_variant_id IS NULL OR salla_variant_id=cs.salla_variant_id) LIMIT 1)))
      ORDER BY CASE WHEN cs.salla_variant_id IS NOT NULL AND ppm.salla_variant_id=cs.salla_variant_id THEN 1
                    WHEN ppm.salla_product_id=cs.salla_product_id THEN 2 ELSE 3 END LIMIT 1) ppm ON true
    JOIN product_renewal_options pro ON pro.tenant_id=cs.tenant_id AND pro.product_mapping_id=ppm.id
      AND pro.is_active=true AND pro.show_in_portal=true
      AND ((pro.link_mode='manual' AND pro.manual_url IS NOT NULL)
        OR (pro.link_mode='automatic' AND pro.resolved_url IS NOT NULL))
    WHERE cs.tenant_id=$1 AND cs.id=$2 ORDER BY pro.sort_order,pro.created_at`, [tenantId, subscriptionId]);
  const items = [];
  for (const item of result.rows) {
    const link = await createRenewalRedirect({ tenantId, subscriptionId, optionId: item.id });
    if (link.ok) items.push({ ...item, url: link.url });
  }
  return items;
}

export async function GET(req, { params }) {
  const { publicId } = await params;
  const secret = new URL(req.url).searchParams.get("t") || "";
  const resolved = await resolveOrderPortalLink(publicId, secret);
  if (!resolved.ok) return response({ ok: false, reason: resolved.reason, message: "رابط الطلب غير صالح أو انتهت صلاحيته." }, resolved.reason === "expired" ? 410 : 404);

  const orderResult = await query(`SELECT l.id,l.tenant_id AS "tenantId",l.subscription_id AS "legacySubscriptionId",
    l.external_order_id AS "externalOrderId",l.order_number AS "orderNumber",l.status AS "linkStatus",
    l.expires_at AS "linkExpiresAt",c.name AS "customerName",COALESCE(c.whatsapp_number,c.phone) AS "phoneNumber",
    p.store_name AS "storeName",p.slug AS "storeSlug",p.logo_url AS "logoUrl",ten.timezone,
    st.support_phone AS "supportPhone",t.name AS "templateName",COALESCE(t.style,p.default_template_style) AS "templateStyle",
    COALESCE(t.theme_color,p.default_theme_color) AS "themeColor",t.header_text AS "headerText",
    t.footer_text AS "footerText",COALESCE(t.additional_notes,'[]'::jsonb) AS "additionalNotes",
    COALESCE(t.visible_fields,'{}'::jsonb) AS "visibleFields",
    s.service_name AS "legacyServiceName",s.plan_name AS "legacyPlanName",s.start_date AS "legacyStartsAt",
    s.end_date AS "legacyExpiresAt",s.status AS "legacyStatus"
    FROM order_info_links l JOIN tenants ten ON ten.id=l.tenant_id
    JOIN order_link_profiles p ON p.tenant_id=l.tenant_id AND p.is_active=true
    JOIN order_info_templates t ON t.id=l.template_id AND t.tenant_id=l.tenant_id AND t.is_active=true
    JOIN subscriptions s ON s.id=l.subscription_id AND s.tenant_id=l.tenant_id
    LEFT JOIN customers c ON c.id=l.customer_id AND c.tenant_id=l.tenant_id
    LEFT JOIN LATERAL (SELECT support_phone FROM stores WHERE tenant_id=l.tenant_id ORDER BY created_at LIMIT 1) st ON true
    WHERE l.id=$1 AND l.tenant_id=$2 LIMIT 1`, [resolved.orderId, resolved.tenantId]);
  const order = orderResult.rows[0];
  if (!order || order.linkStatus !== "active") return response({ ok: false, reason: "order_not_available", message: "هذا الطلب غير متاح حاليًا." }, 410);
  if (order.linkExpiresAt && new Date(order.linkExpiresAt) <= new Date()) return response({ ok: false, reason: "expired", message: "انتهت صلاحية رابط الطلب." }, 410);

  const serverNow = new Date();
  const subscriptions = await query(`SELECT cs.id,cs.salla_order_item_id AS "orderItemId",cs.service_name AS "serviceName",
    sp.name AS "planName",cs.status,cs.starts_at AS "startsAt",cs.expires_at AS "expiresAt",
    cs.duration_value AS "durationValue",cs.duration_unit AS "durationUnit"
    FROM customer_subscriptions cs JOIN subscription_plans sp ON sp.id=cs.plan_id
    WHERE cs.tenant_id=$1 AND (cs.legacy_subscription_id=$2
      OR ($3::text IS NOT NULL AND cs.salla_order_id=$3) OR cs.order_number=$4)
    ORDER BY cs.created_at,cs.salla_order_item_id`,
    [order.tenantId, order.legacySubscriptionId, order.externalOrderId, order.orderNumber]);

  const rows = subscriptions.rows.length ? subscriptions.rows : [{
    id: null, orderItemId: order.legacySubscriptionId, serviceName: order.legacyServiceName,
    planName: order.legacyPlanName, status: order.legacyStatus, startsAt: order.legacyStartsAt,
    expiresAt: order.legacyExpiresAt, durationValue: null, durationUnit: null
  }];
  const items = [];
  for (const item of rows) {
    let remaining;
    try { remaining = calculateRemainingTime({ startsAt: item.startsAt, expiresAt: item.expiresAt, now: serverNow }); }
    catch { remaining = { status: "invalid", remainingMs: 0, remainingDays: 0, remainingHours: 0, remainingMinutes: 0, progressPercentage: 0 }; }
    const displayStatus = remaining.status === "expired" ? "expired"
      : remaining.status === "pending" ? "pending_activation"
        : remaining.remainingMs <= 7 * 86400000 ? "expiring_soon" : item.status;
    items.push({
      id: item.id, orderItemId: item.orderItemId, serviceName: item.serviceName, planName: item.planName,
      status: displayStatus, startsAt: new Date(item.startsAt).toISOString(), expiresAt: new Date(item.expiresAt).toISOString(),
      durationValue: item.durationValue == null ? null : Number(item.durationValue), durationUnit: item.durationUnit,
      durationLabel: durationLabel(item.durationValue, item.durationUnit), durationConfigured: Boolean(durationLabel(item.durationValue, item.durationUnit)),
      remaining, renewalOptions: item.id ? await renewalOptions(order.tenantId, item.id) : []
    });
  }
  return response({ ok: true, data: {
    serverNow: serverNow.toISOString(),
    store: { name: order.storeName, slug: order.storeSlug, logoUrl: order.logoUrl, supportPhone: order.supportPhone, timezone: order.timezone || "Asia/Riyadh" },
    order: { orderNumber: order.orderNumber, customerName: order.customerName, maskedPhone: maskPublicPhone(order.phoneNumber) },
    template: { name: order.templateName, style: order.templateStyle, themeColor: order.themeColor,
      headerText: order.headerText, footerText: order.footerText, additionalNotes: order.additionalNotes, visibleFields: order.visibleFields },
    items
  } });
}
