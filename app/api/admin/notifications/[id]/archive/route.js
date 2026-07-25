import { auditAdmin, requireAdminPermission } from "../../../../../../src/server/admin-auth.js";
import { query } from "../../../../../../src/server/db.js";
import { sameOriginRequest } from "../../../../../../src/server/platform-notifications.js";

export async function POST(request, { params }) {
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const auth = await requireAdminPermission(request, "notifications", "archive");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await query(
    `UPDATE platform_notifications SET status='archived',archived_at=now(),updated_by_admin_user_id=$2,updated_at=now()
      WHERE id=$1 AND status IN ('cancelled','published','partially_published','failed')
      RETURNING id`,
    [id, auth.admin.adminId]
  );
  if (!result.rows[0]) return Response.json({ ok: false, reason: "notification_not_archivable" }, { status: 409 });
  await auditAdmin(request, { admin: auth.admin, action: "admin.notification.archived", resource: id });
  return Response.json({ ok: true, message: "تمت أرشفة الإشعار مع الاحتفاظ بالسجل والإحصائيات." });
}
