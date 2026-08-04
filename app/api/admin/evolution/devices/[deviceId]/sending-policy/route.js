import { auditAdmin, requireAdminPermission } from "../../../../../../../src/server/admin-auth.js";
import { query } from "../../../../../../../src/server/db.js";
import { getEvolutionSendingPolicy, updateEvolutionSendingPolicy } from "../../../../../../../src/server/evolution-sending-policy.js";
import { sameOriginRequest } from "../../../../../../../src/server/platform-notifications.js";
import { safeErrorMessage } from "../../../../../../../src/server/security.js";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const auth = await requireAdminPermission(request, "evolution.devices", "view");
  if (!auth.ok) return auth.response;
  const { deviceId } = await params;
  const policy = await getEvolutionSendingPolicy(deviceId);
  if (!policy) return Response.json({ ok: false, reason: "device_not_found" }, { status: 404 });
  return Response.json({ ok: true, policy }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function PUT(request, { params }) {
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const auth = await requireAdminPermission(request, "evolution.devices", "manage_policy");
  if (!auth.ok) return auth.response;
  const { deviceId } = await params;
  const recent = await query(
    `SELECT count(*)::int AS count FROM admin_audit_logs
      WHERE admin_user_id=$1 AND action='admin.evolution.policy.updated'
        AND resource=$2 AND created_at>now()-interval '5 minutes'`,
    [auth.admin.adminId, deviceId]
  );
  if (Number(recent.rows[0]?.count || 0) >= 12) return Response.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  try {
    const policy = await updateEvolutionSendingPolicy(deviceId, body, auth.admin.adminId);
    await auditAdmin(request, {
      admin: auth.admin,
      action: "admin.evolution.policy.updated",
      resource: deviceId,
      metadata: { changedFields: Object.keys(body).filter((key) => !/secret|token|code|qr/i.test(key)) }
    });
    return Response.json({ ok: true, policy });
  } catch (error) {
    await auditAdmin(request, { admin: auth.admin, action: "admin.evolution.policy.updated", resource: deviceId, status: "failed", metadata: { reason: error?.code || "update_failed" } });
    return Response.json({ ok: false, reason: error?.code || "policy_update_failed", message: safeErrorMessage(error) }, { status: error?.code === "device_not_found" ? 404 : 400 });
  }
}
