import { auditAdmin, requireAdminPermission } from "../../../../../../src/server/admin-auth.js";
import { query, transaction } from "../../../../../../src/server/db.js";
import { sameOriginRequest } from "../../../../../../src/server/platform-notifications.js";

export async function POST(request, { params }) {
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const auth = await requireAdminPermission(request, "notifications", "cancel");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await transaction(async (client) => {
    const updated = await client.query(
      `UPDATE platform_notifications SET status='cancelled',cancelled_at=now(),updated_by_admin_user_id=$2,updated_at=now()
        WHERE id=$1 AND status IN ('validating','scheduled','preparing','publishing','published','partially_published')
        RETURNING id,created_recipients AS "createdRecipients"`,
      [id, auth.admin.adminId]
    );
    if (!updated.rows[0]) return null;
    await client.query("UPDATE platform_notification_outbox SET status='cancelled' WHERE notification_id=$1 AND status IN ('pending','processing','failed')", [id]);
    await client.query("UPDATE platform_notification_recipients SET delivery_status='withdrawn' WHERE notification_id=$1", [id]);
    return updated.rows[0];
  });
  if (!result) return Response.json({ ok: false, reason: "notification_not_cancellable" }, { status: 409 });
  await auditAdmin(request, { admin: auth.admin, action: "admin.notification.cancelled", resource: id, metadata: { createdRecipients: result.createdRecipients } });
  return Response.json({ ok: true, message: result.createdRecipients ? `تم إيقاف نشر الإشعار. وصل بالفعل إلى ${result.createdRecipients} مستخدمًا.` : "تم إلغاء الإشعار المجدول. لن يظهر لأي مستخدم." });
}
