import { query, transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";
import { normalizedTemplateInput } from "../../../../src/server/order-links.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT id, name, style, theme_color AS "themeColor", store_name AS "storeName",
            header_text AS "headerText", footer_text AS "footerText",
            additional_notes AS "additionalNotes", visible_fields AS "visibleFields",
            is_default AS "isDefault", is_active AS "isActive",
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM order_info_templates
      WHERE tenant_id = $1 ORDER BY is_default DESC, updated_at DESC`,
    [auth.session.tenantId]
  );
  return Response.json({ ok: true, items: result.rows });
}

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const input = normalizedTemplateInput(await req.json().catch(() => ({})));
  if (!input.ok) return Response.json({ ok: false, reason: input.reason }, { status: 400 });
  const item = await transaction(async (client) => {
    if (input.value.isDefault) {
      await client.query("UPDATE order_info_templates SET is_default = false, updated_at = now() WHERE tenant_id = $1", [auth.session.tenantId]);
    }
    const inserted = await client.query(
      `INSERT INTO order_info_templates (
         tenant_id, name, style, theme_color, store_name, header_text, footer_text,
         additional_notes, visible_fields, is_default, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)
       RETURNING id, name, style, theme_color AS "themeColor", store_name AS "storeName",
                 header_text AS "headerText", footer_text AS "footerText",
                 additional_notes AS "additionalNotes", visible_fields AS "visibleFields",
                 is_default AS "isDefault", is_active AS "isActive",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [auth.session.tenantId, input.value.name, input.value.style, input.value.themeColor, input.value.storeName,
        input.value.headerText, input.value.footerText, JSON.stringify(input.value.additionalNotes),
        JSON.stringify(input.value.visibleFields), input.value.isDefault, input.value.isActive]
    );
    await client.query(
      "INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata) VALUES ($1, $2, 'order_template.created', 'Order information template created', $3::jsonb)",
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ templateId: inserted.rows[0].id })]
    );
    return inserted.rows[0];
  });
  return Response.json({ ok: true, item }, { status: 201 });
}
