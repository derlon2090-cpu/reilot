import { maskPublicPhone } from "../../../../../../src/lib/orderLinks.js";
import { query, transaction } from "../../../../../../src/server/db.js";
import { hashOrderLinkIp, publicOrderPayload } from "../../../../../../src/server/order-links.js";
import { sha256 } from "../../../../../../src/server/security.js";

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
    `SELECT l.id, l.tenant_id AS "tenantId", l.status AS "linkStatus", l.expires_at AS "expiresAt",
            l.order_number AS "orderNumber", p.store_name AS "storeName", p.slug AS "storeSlug",
            p.logo_url AS "logoUrl", st.support_phone AS "supportPhone",
            s.plan_name AS "planName", s.service_name AS "serviceName",
            s.start_date AS "startDate", s.end_date AS "endDate", s.status AS "subscriptionStatus",
            c.name AS "customerName", COALESCE(c.whatsapp_number, c.phone) AS "phoneNumber",
            t.name AS "templateName", COALESCE(t.style, p.default_template_style) AS "templateStyle",
            COALESCE(t.theme_color, p.default_theme_color) AS "themeColor",
            t.header_text AS "headerText", t.footer_text AS "footerText",
            COALESCE(t.additional_notes, '[]'::jsonb) AS "additionalNotes",
            COALESCE(t.visible_fields, '{}'::jsonb) AS "visibleFields"
       FROM order_info_links l
       JOIN order_link_profiles p ON p.tenant_id = l.tenant_id AND p.is_active = true
       JOIN subscriptions s ON s.id = l.subscription_id AND s.tenant_id = l.tenant_id
       LEFT JOIN customers c ON c.id = l.customer_id AND c.tenant_id = l.tenant_id
       LEFT JOIN order_info_templates t ON t.id = l.template_id AND t.tenant_id = l.tenant_id
       LEFT JOIN LATERAL (
         SELECT support_phone FROM stores WHERE tenant_id = l.tenant_id ORDER BY created_at LIMIT 1
       ) st ON true
      WHERE lower(p.slug) = lower($1) AND l.order_number = $2 AND l.public_token = $3
      LIMIT 1`,
    [storeSlug, orderNumber, sha256(token)]
  );
  const row = result.rows[0];
  if (!row) return noStore({ ok: false, reason: "invalid_link", message: "لم يتم العثور على الطلب أو الرابط غير صالح." }, { status: 404 });
  if (row.linkStatus !== "active") {
    return noStore({ ok: false, reason: row.linkStatus, message: "هذا الرابط غير متاح حاليًا. تواصل مع المتجر للحصول على رابط جديد." }, { status: 410 });
  }
  if (row.expiresAt && new Date(row.expiresAt) <= new Date()) {
    await transaction(async (client) => {
      await client.query("UPDATE order_info_links SET status = 'expired', updated_at = now() WHERE id = $1 AND status = 'active'", [row.id]);
      await client.query("INSERT INTO order_link_events (tenant_id, order_info_link_id, event_type) VALUES ($1, $2, 'expired')", [row.tenantId, row.id]);
    });
    return noStore({ ok: false, reason: "expired", message: "انتهت صلاحية هذا الرابط. تواصل مع المتجر للحصول على رابط جديد." }, { status: 410 });
  }
  row.maskedPhone = maskPublicPhone(row.phoneNumber);
  const checked = new URL(req.url).searchParams.get("checked") === "1";
  await transaction(async (client) => {
    await client.query(
      `UPDATE order_info_links SET opened_count = opened_count + 1, last_opened_at = now(), updated_at = now()
        WHERE id = $1`,
      [row.id]
    );
    await client.query(
      `INSERT INTO order_link_events (tenant_id, order_info_link_id, event_type, ip_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.tenantId, row.id, checked ? "order_checked" : "opened", hashOrderLinkIp(req), String(req.headers.get("user-agent") || "").slice(0, 500) || null]
    );
  });
  return noStore({ ok: true, data: publicOrderPayload(row) });
}
