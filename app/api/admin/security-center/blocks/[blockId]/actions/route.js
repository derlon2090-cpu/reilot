import { auditAdmin, requireAdminPermission } from "../../../../../../../src/server/admin-auth.js";
import { revokeSecurityBlock } from "../../../../../../../src/server/security-center.js";

export async function POST(request, { params }) {
  const auth = await requireAdminPermission(request, "incidents", "manage");
  if (!auth.ok) return auth.response;
  const { blockId } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.action !== "unblock") return Response.json({ ok: false, reason: "unsupported_action" }, { status: 400 });
  try {
    const result = await revokeSecurityBlock({ blockId, adminId: auth.admin.adminId, reason: body.reason });
    await auditAdmin(request, {
      admin: auth.admin,
      action: "security_block.unblock",
      resource: blockId,
      metadata: { referenceId: result.reference_id, reason: String(body.reason || "").slice(0, 300) }
    });
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ ok: false, reason: error?.code || "unblock_failed" }, { status: error?.code === "NOT_FOUND" ? 404 : 400 });
  }
}
