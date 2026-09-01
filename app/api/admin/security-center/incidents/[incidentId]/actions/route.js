import { auditAdmin, requireAdminPermission } from "../../../../../../../src/server/admin-auth.js";
import { applyTemporaryMitigation, containSecurityIncident, updateIncidentStatus } from "../../../../../../../src/server/security-center.js";

export async function POST(request, { params }) {
  const auth = await requireAdminPermission(request, "incidents", "manage");
  if (!auth.ok) return auth.response;
  const { incidentId } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const result = body.action === "contain_threat"
      ? await containSecurityIncident({
        incidentId,
        adminId: auth.admin.adminId,
        duration: body.duration,
        scopes: body.scopes,
        reason: body.reason
      })
      : body.action === "temporary_block"
      ? await applyTemporaryMitigation({ incidentId, adminId: auth.admin.adminId, minutes: body.minutes, reason: body.reason })
      : body.action === "set_status"
        ? await updateIncidentStatus({ incidentId, status: body.status, adminId: auth.admin.adminId, reason: body.reason })
        : null;
    if (!result) return Response.json({ ok: false, reason: "unsupported_action" }, { status: 400 });
    await auditAdmin(request, { admin: auth.admin, action: `incident.${body.action}`, resource: incidentId, metadata: {
      durationMinutes: body.minutes || null,
      duration: body.duration || null,
      scopes: Array.isArray(body.scopes) ? body.scopes.slice(0, 4) : [],
      status: body.status || null,
      reason: String(body.reason || "").slice(0, 300)
    } });
    return Response.json({ ok: true, result });
  } catch (error) {
    const status = error?.code === "NOT_FOUND" ? 404 : 400;
    return Response.json({ ok: false, reason: error?.code || "action_failed" }, { status });
  }
}
