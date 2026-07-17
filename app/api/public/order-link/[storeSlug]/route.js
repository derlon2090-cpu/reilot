import { GET as getOrderByNumber } from "./[orderNumber]/route.js";
import { normalizeOrderLinkColor, normalizeOrderLinkStyle } from "../../../../../src/lib/orderLinks.js";
import { query } from "../../../../../src/server/db.js";
import { sha256 } from "../../../../../src/server/security.js";

function noStore(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Cache-Control", "no-store, private, max-age=0");
  return Response.json(body, { ...init, headers });
}

export async function GET(req, { params }) {
  const { storeSlug } = await params;
  const url = new URL(req.url);
  const orderNumber = url.searchParams.get("orderNumber")?.trim().replace(/^#/, "") || "";
  const token = url.searchParams.get("t") || "";
  if (!orderNumber && token.length >= 8) {
    const result = await query(
      `SELECT tl.status AS "linkStatus", tl.expires_at AS "expiresAt",
              p.store_name AS "storeName", p.slug AS "storeSlug", p.logo_url AS "logoUrl",
              COALESCE(t.style, p.default_template_style) AS "templateStyle",
              COALESCE(t.theme_color, p.default_theme_color) AS "themeColor",
              t.header_text AS "headerText", t.footer_text AS "footerText"
         FROM order_template_links tl
         JOIN order_link_profiles p ON p.tenant_id = tl.tenant_id AND p.is_active = true
         JOIN order_info_templates t ON t.id = tl.template_id AND t.tenant_id = tl.tenant_id AND t.is_active = true
        WHERE lower(p.slug) = lower($1) AND tl.public_token = $2
        ORDER BY tl.created_at DESC
        LIMIT 1`,
      [storeSlug, sha256(token)]
    );
    const row = result.rows[0];
    if (!row) return noStore({ ok: false, reason: "invalid_link", message: "لم يتم العثور على الرابط أو أنه غير صالح." }, { status: 404 });
    if (row.linkStatus !== "active") {
      return noStore({ ok: false, reason: row.linkStatus, message: "هذا الرابط غير متاح حاليًا. تواصل مع المتجر للحصول على رابط جديد." }, { status: 410 });
    }
    if (row.expiresAt && new Date(row.expiresAt) <= new Date()) {
      return noStore({ ok: false, reason: "expired", message: "انتهت صلاحية هذا الرابط. تواصل مع المتجر للحصول على رابط جديد." }, { status: 410 });
    }
    return noStore({
      ok: true,
      presentation: {
        store: { name: row.storeName, slug: row.storeSlug, logoUrl: row.logoUrl || null },
        template: {
          style: normalizeOrderLinkStyle(row.templateStyle),
          themeColor: normalizeOrderLinkColor(row.themeColor),
          headerText: row.headerText || null,
          footerText: row.footerText || null
        }
      }
    });
  }
  if (!orderNumber || orderNumber.length > 100) {
    return noStore({ ok: false, reason: "order_number_required", message: "اكتب رقم الطلب الصحيح." }, { status: 400 });
  }
  return getOrderByNumber(req, { params: Promise.resolve({ storeSlug, orderNumber }) });
}
