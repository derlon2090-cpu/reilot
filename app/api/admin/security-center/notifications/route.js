import { requireAdminPermission } from "../../../../../src/server/admin-auth.js";
import {
  listSecurityNotifications,
  markAllSecurityNotificationsRead,
  markSecurityNotificationRead
} from "../../../../../src/server/security-center.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAdminPermission(request, "inspector", "read");
  if (!auth.ok) return auth.response;
  const limit = Number(new URL(request.url).searchParams.get("limit") || 10);
  const feed = await listSecurityNotifications(auth.admin.adminId, limit);
  return Response.json({ ok: true, ...feed }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request) {
  const auth = await requireAdminPermission(request, "inspector", "read");
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const result = body.all
    ? await markAllSecurityNotificationsRead(auth.admin.adminId)
    : await markSecurityNotificationRead({
      notificationId: String(body.notificationId || ""),
      adminId: auth.admin.adminId,
      read: body.read !== false
    });
  if (!body.all && !result) return Response.json({ ok: false, reason: "notification_not_found" }, { status: 404 });
  return Response.json({ ok: true, result });
}
