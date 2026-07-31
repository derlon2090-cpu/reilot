import { z } from "zod";
import { requireAdminPermission } from "../../../../../../src/server/admin-auth.js";
import { query } from "../../../../../../src/server/db.js";
import { renderAdminTemplate } from "../../../../../../src/server/admin-messaging.js";

const schema = z.object({
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  channel: z.enum(["email", "evolution_whatsapp"]).optional(),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().max(10000).optional()
});

export async function POST(request, { params }) {
  const auth = await requireAdminPermission(request, "templates", "read");
  if (!auth.ok) return auth.response;
  const { templateKey } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "validation_error" }, { status: 400 });
  const result = await query(
    `SELECT template_key AS "templateKey",channel,subject,body,allowed_variables AS "allowedVariables",
            required_variables AS "requiredVariables",is_active AS "isActive"
       FROM admin_message_templates WHERE template_key=$1`, [templateKey]
  );
  const template = result.rows[0];
  if (!template) return Response.json({ ok: false, reason: "template_not_found" }, { status: 404 });
  try {
    const rendered = renderAdminTemplate({
      ...template,
      subject: parsed.data.subject === undefined ? template.subject : parsed.data.subject,
      body: parsed.data.body === undefined ? template.body : parsed.data.body
    }, parsed.data.values, { maskTemporaryPassword: true });
    return Response.json({ ok: true, rendered, channel: parsed.data.channel || template.channel, isPreview: true }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ ok: false, reason: error.code || "render_failed", variables: error.variables || [] }, { status: 400 });
  }
}
