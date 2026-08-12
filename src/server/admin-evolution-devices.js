import crypto from "node:crypto";
import { query } from "./db.js";
import { evolutionAdminAdapter } from "./admin-evolution-provider.js";

export const ADMIN_DEVICE_STATUS_LABELS = Object.freeze({
  not_connected: "بانتظار الاقتران",
  pending_qr: "بانتظار الاقتران",
  pending_pairing: "بانتظار الاقتران",
  connecting: "جارٍ الاتصال",
  connected: "متصل",
  disconnected: "غير متصل",
  logged_out: "تم تسجيل الخروج",
  expired: "بانتظار الاقتران",
  error: "يحتاج متابعة",
  disabled: "متوقف"
});

export function normalizeAdminDeviceStatus(value) {
  const raw = String(value || "not_connected").toLowerCase();
  if (["open", "online", "ready"].includes(raw)) return "connected";
  if (["close", "closed", "offline"].includes(raw)) return "disconnected";
  if (["pending_qr", "pending_pairing", "expired", "not_connected"].includes(raw)) return "pending_pairing";
  if (["connecting", "connected", "disconnected", "logged_out", "error", "disabled"].includes(raw)) return raw;
  return "error";
}

export function adminDeviceStatusLabel(value) {
  return ADMIN_DEVICE_STATUS_LABELS[value] || ADMIN_DEVICE_STATUS_LABELS[normalizeAdminDeviceStatus(value)];
}

export function maskAdminDevicePhone(value, canViewFullPhone = false) {
  const phone = String(value || "").replace(/\D/g, "");
  if (!phone) return "—";
  if (canViewFullPhone || phone.length < 7) return `+${phone}`;
  return `+${phone.slice(0, 4)}••••${phone.slice(-3)}`;
}

export function deviceMessageMetrics({ sent = 0, delivered = 0, failed = 0, today = 0 } = {}) {
  const sentCount = Math.max(0, Number(sent) || 0);
  const failedCount = Math.max(0, Number(failed) || 0);
  const attempted = sentCount + failedCount;
  return {
    sent: sentCount,
    delivered: Math.max(0, Number(delivered) || 0),
    failed: failedCount,
    today: Math.max(0, Number(today) || 0),
    successRate: attempted ? Math.round((sentCount / attempted) * 1000) / 10 : null
  };
}

export function isAdminPairingExpired(expiresAt, now = Date.now()) {
  const value = new Date(expiresAt || 0).getTime();
  return !Number.isFinite(value) || value <= now;
}

export function adminEvolutionFailureStatus(error) {
  const code = String(error?.code || "");
  if (code === "device_not_found" || code === "EVOLUTION_ADMIN_INSTANCE_NOT_FOUND") return 404;
  if (code === "EVOLUTION_ADMIN_INSTANCE_EXISTS") return 409;
  if (["EVOLUTION_ADMIN_NOT_CONFIGURED", "EVOLUTION_ADMIN_AUTH_FAILED"].includes(code)) return 503;
  if (["EVOLUTION_ADMIN_TIMEOUT", "EVOLUTION_ADMIN_UNREACHABLE", "EVOLUTION_ADMIN_REQUEST_FAILED"].includes(code)) return 502;
  return 400;
}

function safePage(value, fallback, max) {
  return Math.min(max, Math.max(1, Number(value) || fallback));
}

function adminInstanceName(adminId) {
  const owner = String(adminId || "platform").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "platform";
  return `admin_${owner}_${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}`;
}

function publicDevice(row) {
  const status = normalizeAdminDeviceStatus(row.status);
  return {
    id: row.id,
    instanceName: row.external_channel_id,
    displayName: row.display_name,
    phoneNumber: row.phone_masked || "—",
    status,
    statusLabel: adminDeviceStatusLabel(status),
    lastSeenAt: row.last_health_check_at || row.last_message_at || row.updated_at,
    connectedAt: status === "connected" ? row.updated_at : null,
    lastError: row.last_error_safe ? "يتطلب فحص الاتصال" : null,
    webhookStatus: row.last_error_safe ? "يحتاج متابعة" : "مهيأ",
    apiStatus: status,
    provider: "evolution_admin"
  };
}

export async function listAdminEvolutionDevices({ search = "", status = "", page = 1, pageSize = 20 }) {
  const pageNumber = safePage(page, 1, 100000);
  const size = [10, 20].includes(Number(pageSize)) ? Number(pageSize) : 20;
  const values = [];
  let where = "WHERE provider='evolution_admin' AND messaging_scope='platform_admin'";
  if (search) {
    values.push(`%${String(search).trim().slice(0, 120)}%`);
    where += ` AND (display_name ILIKE $${values.length} OR COALESCE(external_channel_id,'') ILIKE $${values.length} OR COALESCE(phone_masked,'') ILIKE $${values.length})`;
  }
  if (status) {
    const statuses = status === "pending" ? ["connecting", "disconnected"]
      : status === "needs_attention" ? ["disconnected", "error"] : [status];
    values.push(statuses);
    where += ` AND status=ANY($${values.length}::text[])`;
  }
  values.push(size, (pageNumber - 1) * size);
  const result = await query(
    `SELECT id,display_name,external_channel_id,phone_masked,status,last_message_at,last_health_check_at,
            last_error_safe,created_at,updated_at,count(*) OVER()::int AS full_count
       FROM platform_messaging_channels
       ${where}
      ORDER BY updated_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return {
    devices: result.rows.map(publicDevice),
    pagination: { page: pageNumber, pageSize: size, total: Number(result.rows[0]?.full_count || 0) }
  };
}

export async function getAdminEvolutionDevice(deviceId) {
  const result = await query(
    `SELECT id,display_name,external_channel_id,phone_masked,status,last_message_at,last_health_check_at,
            last_error_safe,created_at,updated_at
       FROM platform_messaging_channels
      WHERE id=$1 AND provider='evolution_admin' AND messaging_scope='platform_admin'
      LIMIT 1`,
    [deviceId]
  );
  return result.rows[0] ? publicDevice(result.rows[0]) : null;
}

export async function createAdminEvolutionDevice({ displayName, phoneNumber = "", adminId = "" }) {
  const idempotencyKey = crypto.createHash("sha256").update(`${adminId}:${displayName}:${Date.now()}`).digest("hex");
  let instanceName = "";
  let providerCreated = false;
  // Generated names are already unique, but retrying provider-side conflicts
  // also recovers safely from stale/orphaned Evolution sessions.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    instanceName = adminInstanceName(adminId);
    try {
      await evolutionAdminAdapter.createInstance({ instanceName, phoneNumber, idempotencyKey: `${idempotencyKey}:${attempt}` });
      providerCreated = true;
      break;
    } catch (error) {
      if (error?.code !== "EVOLUTION_ADMIN_INSTANCE_EXISTS" || attempt === 2) throw error;
    }
  }
  if (!providerCreated) throw Object.assign(new Error("Evolution instance could not be created"), { code: "EVOLUTION_ADMIN_CREATE_FAILED" });
  try {
    const inserted = await query(
      `INSERT INTO platform_messaging_channels
         (provider,messaging_scope,display_name,external_channel_id,phone_masked,status,last_health_check_at)
       VALUES ('evolution_admin','platform_admin',$1,$2,$3,'disconnected',now())
       RETURNING id`,
      [String(displayName || "جهاز واتساب الإداري").trim().slice(0, 100), instanceName, maskAdminDevicePhone(phoneNumber)]
    );
    return getAdminEvolutionDevice(inserted.rows[0].id);
  } catch (error) {
    await evolutionAdminAdapter.deleteInstance({ instanceName }).catch(() => null);
    throw error;
  }
}

export async function adminEvolutionDeviceAction({ deviceId, action, phoneNumber = "" }) {
  const device = await getAdminEvolutionDevice(deviceId);
  if (!device) throw Object.assign(new Error("Device not found"), { code: "device_not_found" });
  const instanceName = device.instanceName;
  if (action === "qr") {
    await evolutionAdminAdapter.ensureInstance({ instanceName });
    const result = await evolutionAdminAdapter.getQrCode({ instanceName });
    if (!result.qrCode) throw Object.assign(new Error("QR unavailable"), { code: "qr_unavailable" });
    await query("UPDATE platform_messaging_channels SET status='connecting',last_health_check_at=now(),updated_at=now() WHERE id=$1", [deviceId]);
    return result;
  }
  if (action === "pairing_code") {
    await evolutionAdminAdapter.ensureInstance({ instanceName, phoneNumber });
    const result = await evolutionAdminAdapter.generatePairingCode({ instanceName, phoneNumber });
    if (!result.pairingCode) throw Object.assign(new Error("Pairing code unavailable"), { code: "pairing_unavailable" });
    await query("UPDATE platform_messaging_channels SET status='connecting',phone_masked=$2,last_health_check_at=now(),updated_at=now() WHERE id=$1", [deviceId, maskAdminDevicePhone(phoneNumber)]);
    return result;
  }
  if (action === "refresh") {
    const state = await evolutionAdminAdapter.getConnectionState({ instanceName });
    const normalized = normalizeAdminDeviceStatus(state?.instance?.state || state?.state || state?.status);
    const databaseStatus = ["logged_out", "pending_pairing"].includes(normalized) ? "disconnected" : normalized;
    await query("UPDATE platform_messaging_channels SET status=$2,last_error_safe=$3,last_health_check_at=now(),updated_at=now() WHERE id=$1", [deviceId, databaseStatus, normalized === "error" ? "provider_state_error" : null]);
    return { status: normalized, statusLabel: adminDeviceStatusLabel(normalized) };
  }
  if (action === "reconnect") {
    await evolutionAdminAdapter.restartInstance({ instanceName });
    await query("UPDATE platform_messaging_channels SET status='connecting',last_error_safe=NULL,updated_at=now() WHERE id=$1", [deviceId]);
    return { status: "connecting", statusLabel: adminDeviceStatusLabel("connecting") };
  }
  if (action === "logout") {
    await evolutionAdminAdapter.logoutInstance({ instanceName });
    await query("UPDATE platform_messaging_channels SET status='disconnected',updated_at=now() WHERE id=$1", [deviceId]);
    return { status: "logged_out", statusLabel: adminDeviceStatusLabel("logged_out") };
  }
  throw Object.assign(new Error("Unsupported device action"), { code: "unsupported_action" });
}

export async function deleteAdminEvolutionDevice(deviceId) {
  const device = await getAdminEvolutionDevice(deviceId);
  if (!device) throw Object.assign(new Error("Device not found"), { code: "device_not_found" });
  await evolutionAdminAdapter.deleteInstance({ instanceName: device.instanceName });
  await query("DELETE FROM platform_messaging_channels WHERE id=$1 AND provider='evolution_admin' AND messaging_scope='platform_admin'", [deviceId]);
  return { deleted: true };
}
