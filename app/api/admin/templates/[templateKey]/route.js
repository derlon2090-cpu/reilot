import { z } from "zod";
import { auditAdmin, requireAdminPermission } from "../../../../../src/server/admin-auth.js";
import { query } from "../../../../../src/server/db.js";
import { validateAdminTemplate } from "../../../../../src/server/admin-messaging.js";

const inputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  channel: z.enum(["email", "evolution_whatsapp"]),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().trim().min(1).max(10000),
  isActive: z.boolean()
});

export async function PUT(request, { params }) {
  const auth = await requireAdminPermission(request, "templates", "update");
  if (!auth.ok) return auth.response;
  const { templateKey } = await params;
  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "validation_error", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  const current = await query(
    `SELECT template_key AS "templateKey",allowed_variables AS "allowedVariables",required_variables AS "requiredVariables"
       FROM admin_message_templates WHERE template_key=$1`, [templateKey]
  );
  if (!current.rows[0]) return Response.json({ ok: false, reason: "template_not_found" }, { status: 404 });
  const validation = validateAdminTemplate({ ...parsed.data, ...current.rows[0] });
  if (!validation.ok) return Response.json({ ok: false, reason: validation.code, variables: validation.variables }, { status: 400 });
  const updated = await query(
    `UPDATE admin_message_templates SET name=$2,description=$3,channel=$4,subject=$5,body=$6,is_active=$7,
            version=version+1,updated_by_admin_user_id=$8,updated_at=now()
      WHERE template_key=$1
      RETURNING template_key AS "templateKey",name,description,channel,subject,body,
                allowed_variables AS "allowedVariables",required_variables AS "requiredVariables",
                is_active AS "isActive",version,updated_at AS "updatedAt"`,
    [templateKey, parsed.data.name, parsed.data.description || null, parsed.data.channel,
      parsed.data.subject || null, parsed.data.body, parsed.data.isActive, auth.admin.adminId]
  );
  await auditAdmin(request, { admin: auth.admin, action: "admin.template.updated", resource: templateKey, metadata: { version: updated.rows[0].version, channel: updated.rows[0].channel } });
  return Response.json({ ok: true, template: updated.rows[0], message: "تم حفظ تعديلات القالب. لن يتم إنشاء نسخة جديدة من القالب." }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
