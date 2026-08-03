import { auditAdmin, requireAdminPermission } from "../../../../../../src/server/admin-auth.js";
import { adminEvolutionDeviceAction } from "../../../../../../src/server/admin-evolution-devices.js";
import { query } from "../../../../../../src/server/db.js";
import { sameOriginRequest } from "../../../../../../src/server/platform-notifications.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";

const PERMISSIONS = { qr: "pair", pairing_code: "pair", refresh: "read", reconnect: "reconnect", logout: "logout" };
const LIMITS = { qr: 10, pairing_code: 10, refresh: 30, reconnect: 8, logout: 4 };

export async function POST(request, { params }) {
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  if (!PERMISSIONS[action]) return Response.json({ ok: false, reason: "unsupported_action" }, { status: 400 });
  const auth = await requireAdminPermission(request, "devices", PERMISSIONS[action]);
  if (!auth.ok) return auth.response;
  const { deviceId } = await params;
  const recent = await query(
    `SELECT count(*)::int AS count FROM admin_audit_logs
      WHERE admin_user_id=$1 AND action=$2 AND resource=$3 AND created_at>now()-interval '5 minutes'`,
    [auth.admin.adminId, `admin.device.${action}`, deviceId]
  );
  if (Number(recent.rows[0]?.count || 0) >= LIMITS[action]) return Response.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  try {
    const result = await adminEvolutionDeviceAction({ deviceId, action, phoneNumber: body.phoneNumber || "" });
    await auditAdmin(request, { admin: auth.admin, action: `admin.device.${action}`, resource: deviceId });
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    await auditAdmin(request, { admin: auth.admin, action: `admin.device.${action}`, resource: deviceId, status: "failed", metadata: { reason: error?.code || "action_failed" } });
    return Response.json({ ok: false, reason: error?.code || "device_action_failed", message: safeErrorMessage(error) }, { status: error?.code === "device_not_found" ? 404 : 400 });
  }
}
