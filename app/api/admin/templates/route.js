import { requireAdminPermission } from "../../../../src/server/admin-auth.js";
import { query } from "../../../../src/server/db.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAdminPermission(request, "templates", "read");
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT id,template_key AS "templateKey",name,description,channel,subject,body,
            allowed_variables AS "allowedVariables",required_variables AS "requiredVariables",
            is_system_template AS "isSystemTemplate",is_active AS "isActive",version,
            created_at AS "createdAt",updated_at AS "updatedAt"
       FROM admin_message_templates ORDER BY created_at`
  );
  return Response.json({ ok: true, templates: result.rows }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

