import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const [links, stats, capabilities] = await Promise.all([
    query(
      `SELECT l.id, l.order_number AS "orderNumber", l.public_url AS "publicUrl",
              l.send_method AS "sendMethod", l.status, l.opened_count AS "openedCount",
              l.last_opened_at AS "lastOpenedAt", l.sent_at AS "sentAt",
              l.expires_at AS "expiresAt", l.created_at AS "createdAt",
              c.name AS "customerName", c.email, COALESCE(c.whatsapp_number, c.phone) AS "phoneNumber",
              t.name AS "templateName", t.style, t.theme_color AS "themeColor"
         FROM order_info_links l
         LEFT JOIN customers c ON c.id = l.customer_id AND c.tenant_id = l.tenant_id
         LEFT JOIN order_info_templates t ON t.id = l.template_id AND t.tenant_id = l.tenant_id
        WHERE l.tenant_id = $1 ORDER BY l.created_at DESC`,
      [auth.session.tenantId]
    ),
    query(
      `SELECT
        (SELECT count(*) FROM order_info_templates WHERE tenant_id = $1 AND is_active = true)::int AS "activeTemplates",
        (SELECT count(*) FROM order_info_links WHERE tenant_id = $1)::int AS "sentLinks",
        (SELECT count(*) FROM order_info_links WHERE tenant_id = $1 AND opened_count > 0)::int AS "openedLinks",
        (SELECT count(*) FROM order_link_events WHERE tenant_id = $1 AND event_type = 'order_checked' AND created_at::date = current_date)::int AS "todayRequests"`,
      [auth.session.tenantId]
    ),
    query(
      `SELECT
        EXISTS(SELECT 1 FROM whatsapp_channels WHERE tenant_id = $1 AND status = 'connected') AS "whatsappConnected",
        EXISTS(SELECT 1 FROM customers WHERE tenant_id = $1 AND email IS NOT NULL) AS "hasCustomerEmail"`,
      [auth.session.tenantId]
    )
  ]);
  const normalized = stats.rows[0] || { activeTemplates: 0, sentLinks: 0, openedLinks: 0, todayRequests: 0 };
  normalized.openRate = normalized.sentLinks > 0 ? Math.round((normalized.openedLinks / normalized.sentLinks) * 1000) / 10 : 0;
  return Response.json({ ok: true, items: links.rows, stats: normalized, capabilities: capabilities.rows[0] || {} });
}
