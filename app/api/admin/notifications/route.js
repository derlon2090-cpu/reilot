import { auditAdmin, requireAdminPermission } from "../../../../src/server/admin-auth.js";
import {
  createPlatformNotification,
  createPlatformNotificationSchema,
  listPlatformNotifications,
  sameOriginRequest
} from "../../../../src/server/platform-notifications.js";
import { query } from "../../../../src/server/db.js";

export async function GET(request) {
  const auth = await requireAdminPermission(request, "notifications", "read");
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const data = await listPlatformNotifications({
    status: url.searchParams.get("status") || "",
    search: (url.searchParams.get("search") || "").trim().slice(0, 120),
    cursor: url.searchParams.get("cursor") || null,
    limit: url.searchParams.get("limit") || 50
  });
  return Response.json({ ok: true, ...data }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request) {
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const raw = await request.json().catch(() => ({}));
  const parsed = createPlatformNotificationSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "validation_error", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const action = parsed.data.scheduleMode === "now" ? "publish" : parsed.data.scheduleMode === "scheduled" ? "schedule" : "create";
  const auth = await requireAdminPermission(request, "notifications", action);
  if (!auth.ok) return auth.response;
  const recent = await query(
    `SELECT count(*)::int AS count FROM admin_audit_logs
      WHERE admin_user_id=$1 AND action='admin.notification.created' AND created_at > now()-interval '1 minute'`,
    [auth.admin.adminId]
  );
  if (Number(recent.rows[0]?.count || 0) >= 5) {
    return Response.json({ ok: false, reason: "rate_limited", message: "تجاوزت الحد المؤقت لإنشاء الإشعارات." }, { status: 429 });
  }
  try {
    const result = await createPlatformNotification({ input: parsed.data, admin: auth.admin, requestUrl: request.url });
    await auditAdmin(request, {
      admin: auth.admin,
      action: "admin.notification.created",
      resource: result.notification.id,
      metadata: { mode: parsed.data.scheduleMode, audienceType: parsed.data.audienceType, estimatedRecipients: result.estimate.eligible }
    });
    const messages = {
      draft: "تم حفظ الإشعار كمسودة. لن يظهر للمستخدمين حتى يتم نشره.",
      scheduled: "تمت جدولة الإشعار بنجاح. سيبدأ النشر تلقائيًا في الموعد المحدد.",
      validating: "بدأ تجهيز جمهور الإشعار. يمكنك متابعة تقدم النشر من سجل الإشعارات."
    };
    return Response.json({ ok: true, ...result, message: messages[result.notification.status] }, { status: 201 });
  } catch (error) {
    return Response.json({ ok: false, reason: error?.code || "notification_create_failed" }, { status: 400 });
  }
}
