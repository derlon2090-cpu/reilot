import { auditAdmin, requireAdminPermission } from "../../../../../src/server/admin-auth.js";
import { deleteAdminEvolutionDevice, getAdminEvolutionDevice } from "../../../../../src/server/admin-evolution-devices.js";
import { sameOriginRequest } from "../../../../../src/server/platform-notifications.js";
import { safeErrorMessage } from "../../../../../src/server/security.js";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const auth = await requireAdminPermission(request, "devices", "read");
  if (!auth.ok) return auth.response;
  const { deviceId } = await params;
  const device = await getAdminEvolutionDevice(deviceId, { admin: auth.admin });
  if (!device) return Response.json({ ok: false, reason: "device_not_found" }, { status: 404 });
  return Response.json({ ok: true, device }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function DELETE(request, { params }) {
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const auth = await requireAdminPermission(request, "devices", "delete");
  if (!auth.ok) return auth.response;
  const { deviceId } = await params;
  try {
    await deleteAdminEvolutionDevice(deviceId);
    await auditAdmin(request, { admin: auth.admin, action: "admin.device.deleted", resource: deviceId });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, reason: error?.code || "device_delete_failed", message: safeErrorMessage(error) }, { status: error?.code === "device_not_found" ? 404 : 400 });
  }
}
