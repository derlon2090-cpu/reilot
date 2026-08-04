import { auditAdmin, requireAdminPermission } from "../../../../src/server/admin-auth.js";
import { createAdminEvolutionDevice, listAdminEvolutionDevices } from "../../../../src/server/admin-evolution-devices.js";
import { query } from "../../../../src/server/db.js";
import { sameOriginRequest } from "../../../../src/server/platform-notifications.js";
import { safeErrorMessage } from "../../../../src/server/security.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAdminPermission(request, "evolution.devices", "view");
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  try {
    const result = await listAdminEvolutionDevices({
      admin: auth.admin,
      search: url.searchParams.get("search") || "",
      status: url.searchParams.get("status") || "",
      storeId: url.searchParams.get("storeId") || "",
      page: url.searchParams.get("page") || 1,
      pageSize: url.searchParams.get("pageSize") || 20
    });
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ ok: false, reason: "devices_load_failed", message: safeErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request) {
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const auth = await requireAdminPermission(request, "evolution.devices", "create");
  if (!auth.ok) return auth.response;
  const recent = await query(
    `SELECT count(*)::int AS count FROM admin_audit_logs
      WHERE admin_user_id=$1 AND action='admin.device.created' AND created_at>now()-interval '5 minutes'`,
    [auth.admin.adminId]
  );
  if (Number(recent.rows[0]?.count || 0) >= 5) return Response.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const displayName = String(body.displayName || "").trim();
  const storeId = String(body.storeId || "").trim();
  const phoneNumber = String(body.phoneNumber || "").replace(/\D/g, "");
  if (!displayName || displayName.length > 100 || !/^[0-9a-f-]{36}$/i.test(storeId) || (phoneNumber && !/^\d{8,15}$/.test(phoneNumber))) {
    return Response.json({ ok: false, reason: "validation_error" }, { status: 400 });
  }
  try {
    const device = await createAdminEvolutionDevice({ storeId, displayName, phoneNumber, adminId: auth.admin.adminId });
    await auditAdmin(request, { admin: auth.admin, action: "admin.device.created", resource: device.id, metadata: { storeId, instanceName: device.instanceName } });
    return Response.json({ ok: true, device }, { status: 201 });
  } catch (error) {
    await auditAdmin(request, { admin: auth.admin, action: "admin.device.created", resource: storeId, status: "failed", metadata: { reason: error?.code || "create_failed" } });
    return Response.json({ ok: false, reason: error?.code || "device_create_failed", message: safeErrorMessage(error) }, { status: error?.code === "store_not_found" ? 404 : 400 });
  }
}
