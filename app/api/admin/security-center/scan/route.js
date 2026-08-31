import { auditAdmin, requireAdminPermission } from "../../../../../src/server/admin-auth.js";
import { runSecurityInspector } from "../../../../../src/server/security-inspector.js";
import { safeErrorMessage } from "../../../../../src/server/security.js";

export async function POST(request) {
  const auth = await requireAdminPermission(request, "inspector", "run");
  if (!auth.ok) return auth.response;
  try {
    const outcome = await runSecurityInspector({ triggerType: "manual", adminId: auth.admin.adminId, force: true });
    await auditAdmin(request, { admin: auth.admin, action: "inspector.run", resource: outcome.runId || "security_inspector", status: outcome.ok ? "success" : "failed", metadata: { reason: outcome.reason || null } });
    return Response.json(outcome, { status: outcome.conflict ? 409 : 200 });
  } catch (error) {
    await auditAdmin(request, { admin: auth.admin, action: "inspector.run", resource: "security_inspector", status: "failed", metadata: { failureCode: String(error?.code || "INSPECTOR_FAILED") } });
    console.error("manual inspector run failed", safeErrorMessage(error));
    return Response.json({ ok: false, reason: "inspector_failed" }, { status: 500 });
  }
}
