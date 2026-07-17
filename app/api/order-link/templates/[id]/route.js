import { query, transaction } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import { ensureTemplatePublicLink, normalizedTemplateInput } from "../../../../../src/server/order-links.js";

export async function PATCH(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const input = normalizedTemplateInput(await req.json().catch(() => ({})));
  if (!input.ok) return Response.json({ ok: false, reason: input.reason }, { status: 400 });
  const item = await transaction(async (client) => {
    if (input.value.isDefault) {
      await client.query("UPDATE order_info_templates SET is_default = false, updated_at = now() WHERE tenant_id = $1 AND id <> $2", [auth.session.tenantId, id]);
    }
    const updated = await client.query(
      `UPDATE order_info_templates SET
         name = $1, style = $2, theme_color = $3, store_name = $4, header_text = $5,
         footer_text = $6, additional_notes = $7::jsonb, visible_fields = $8::jsonb,
         is_default = $9, is_active = $10, updated_at = now()
       WHERE id = $11 AND tenant_id = $12
       RETURNING id, name, style, theme_color AS "themeColor", store_name AS "storeName",
                 header_text AS "headerText", footer_text AS "footerText",
                 additional_notes AS "additionalNotes", visible_fields AS "visibleFields",
                 is_default AS "isDefault", is_active AS "isActive",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [input.value.name, input.value.style, input.value.themeColor, input.value.storeName,
        input.value.headerText, input.value.footerText, JSON.stringify(input.value.additionalNotes),
        JSON.stringify(input.value.visibleFields), input.value.isDefault, input.value.isActive, id, auth.session.tenantId]
    );
    return updated.rows[0] || null;
  });
  if (!item) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  const templateLink = await ensureTemplatePublicLink({ tenantId: auth.session.tenantId, templateId: item.id });
  if (!templateLink.ok) return Response.json(templateLink, { status: 400 });
  return Response.json({
    ok: true,
    item: {
      ...item,
      templateLinkId: templateLink.item.id,
      publicUrl: templateLink.item.publicUrl,
      linkStatus: templateLink.item.status,
      openedCount: templateLink.item.openedCount || 0
    }
  });
}

export async function DELETE(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await query(
    "DELETE FROM order_info_templates WHERE id = $1 AND tenant_id = $2 RETURNING id",
    [id, auth.session.tenantId]
  );
  return result.rows[0] ? Response.json({ ok: true }) : Response.json({ ok: false, reason: "not_found" }, { status: 404 });
}
