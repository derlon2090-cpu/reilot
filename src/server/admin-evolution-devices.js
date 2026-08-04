import crypto from "node:crypto";
import { adminCan } from "./admin-auth.js";
import { query } from "./db.js";
import { evolutionAdminAdapter } from "./admin-evolution-provider.js";
import { calculateEvolutionRisk, getEvolutionSendingPolicy } from "./evolution-sending-policy.js";
import { createChannel, deleteChannel, evolutionInstanceName, updateChannel } from "./whatsapp-repository.js";

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
  risk_hold: "يحتاج متابعة",
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

function safePage(value, fallback, max) {
  return Math.min(max, Math.max(1, Number(value) || fallback));
}

function filterStatusClause(status, values) {
  if (!status) return "";
  if (status === "needs_attention") {
    values.push(["disconnected", "error", "risk_hold", "not_connected", "pending_qr", "pending_pairing", "expired"]);
    return ` AND wc.status = ANY($${values.length}::text[])`;
  }
  const mapped = status === "pending" ? ["not_connected", "pending_qr", "pending_pairing", "expired"] : [status];
  values.push(mapped);
  return ` AND wc.status = ANY($${values.length}::text[])`;
}

export async function listAdminEvolutionDevices({ admin, search = "", status = "", storeId = "", page = 1, pageSize = 20 }) {
  const safePageNumber = safePage(page, 1, 100000);
  const safePageSize = [10, 20].includes(Number(pageSize)) ? Number(pageSize) : 20;
  const values = [];
  let where = "WHERE wc.provider IN ('evolution_admin','evolution')";
  if (search) {
    values.push(`%${String(search).trim().slice(0, 120)}%`);
    where += ` AND (wc.display_name ILIKE $${values.length} OR wc.device_name ILIKE $${values.length} OR wc.instance_name ILIKE $${values.length} OR wc.phone_number ILIKE $${values.length} OR t.name ILIKE $${values.length} OR COALESCE(s.name,'') ILIKE $${values.length})`;
  }
  where += filterStatusClause(status, values);
  if (storeId) {
    values.push(storeId);
    where += ` AND s.id = $${values.length}`;
  }
  values.push(safePageSize, (safePageNumber - 1) * safePageSize);
  const limitIndex = values.length - 1;
  const offsetIndex = values.length;
  const result = await query(
    `WITH device_rows AS (
       SELECT wc.id,wc.tenant_id,wc.instance_name,wc.display_name,wc.device_name,wc.phone_number,wc.status,
              wc.connection_state,wc.connected_at,wc.disconnected_at,wc.last_health_check_at,wc.last_send_at,
              wc.last_error,wc.created_at,wc.updated_at,t.name AS tenant_name,s.id AS store_id,s.name AS store_name,
              COALESCE(m.sent,0)::int AS sent,COALESCE(m.delivered,0)::int AS delivered,
              COALESCE(m.failed,0)::int AS failed,COALESCE(m.today,0)::int AS today,
              count(*) OVER()::int AS full_count
         FROM whatsapp_channels wc
         JOIN tenants t ON t.id=wc.tenant_id
         LEFT JOIN LATERAL (SELECT id,name FROM stores WHERE tenant_id=wc.tenant_id ORDER BY created_at LIMIT 1) s ON true
         LEFT JOIN LATERAL (
           SELECT count(*) FILTER (WHERE status IN ('sent','delivered','read')) AS sent,
                  count(*) FILTER (WHERE status IN ('delivered','read')) AS delivered,
                  count(*) FILTER (WHERE status='failed') AS failed,
                  count(*) FILTER (WHERE created_at::date=CURRENT_DATE AND status IN ('sent','delivered','read')) AS today
             FROM notification_logs WHERE whatsapp_channel_id=wc.id
         ) m ON true
         ${where}
         ORDER BY wc.updated_at DESC
         LIMIT $${limitIndex} OFFSET $${offsetIndex}
     ) SELECT * FROM device_rows`,
    values
  );
  const canViewFullPhone = adminCan(admin, "devices", "view_phone");
  const devices = result.rows.map((row) => {
    const metrics = deviceMessageMetrics(row);
    const normalizedStatus = normalizeAdminDeviceStatus(row.status);
    return {
      id: row.id,
      instanceName: row.instance_name,
      displayName: row.display_name || row.device_name || row.instance_name,
      storeId: row.store_id,
      storeName: row.store_name || row.tenant_name,
      phoneNumber: maskAdminDevicePhone(row.phone_number, canViewFullPhone),
      status: normalizedStatus,
      statusLabel: adminDeviceStatusLabel(normalizedStatus),
      lastSeenAt: row.last_health_check_at || row.last_send_at || row.updated_at,
      connectedAt: row.connected_at,
      disconnectedAt: row.disconnected_at,
      lastError: row.last_error ? "يتطلب فحص الاتصال" : null,
      metrics
    };
  });
  const totals = await query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status='connected')::int AS connected,
            count(*) FILTER (WHERE status IN ('not_connected','pending_qr','pending_pairing','expired','disconnected','error','risk_hold'))::int AS attention,
            COALESCE(sum(daily_sent),0)::int AS messages_today
       FROM whatsapp_channels WHERE provider IN ('evolution_admin','evolution')`
  );
  const stores = await query("SELECT id,name FROM stores ORDER BY name LIMIT 500");
  return {
    devices,
    stores: stores.rows,
    pagination: { page: safePageNumber, pageSize: safePageSize, total: Number(result.rows[0]?.full_count || 0) },
    stats: {
      total: Number(totals.rows[0]?.total || 0),
      connected: Number(totals.rows[0]?.connected || 0),
      attention: Number(totals.rows[0]?.attention || 0),
      messagesToday: Number(totals.rows[0]?.messages_today || 0)
    }
  };
}

export async function getAdminEvolutionDevice(deviceId, { admin }) {
  const canViewFullPhone = adminCan(admin, "devices", "view_phone");
  const result = await query(
    `SELECT wc.*,t.name AS tenant_name,s.id AS store_id,s.name AS store_name
       FROM whatsapp_channels wc JOIN tenants t ON t.id=wc.tenant_id
       LEFT JOIN LATERAL (SELECT id,name FROM stores WHERE tenant_id=wc.tenant_id ORDER BY created_at LIMIT 1) s ON true
      WHERE wc.id=$1 AND wc.provider IN ('evolution_admin','evolution') LIMIT 1`,
    [deviceId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const metricResult = await query(
    `SELECT count(*) FILTER (WHERE status IN ('sent','delivered','read'))::int AS sent,
            count(*) FILTER (WHERE status IN ('delivered','read'))::int AS delivered,
            count(*) FILTER (WHERE status='failed')::int AS failed,
            count(*) FILTER (WHERE created_at::date=CURRENT_DATE AND status IN ('sent','delivered','read'))::int AS today
       FROM notification_logs WHERE whatsapp_channel_id=$1`,
    [deviceId]
  );
  const activity = await query(
    `SELECT id,type,title,created_at AS "createdAt" FROM activity_logs
      WHERE tenant_id=$1 AND (metadata->>'deviceId'=$2 OR metadata->>'instanceName'=$3)
      ORDER BY created_at DESC LIMIT 5`,
    [row.tenant_id, deviceId, row.instance_name]
  );
  const risk = calculateEvolutionRisk({
    failureRate: row.failure_rate,
    status: normalizeAdminDeviceStatus(row.status),
    webhookHealthy: !row.last_error,
    disconnects24h: row.disconnected_at && new Date(row.disconnected_at) > new Date(Date.now() - 86400000) ? 1 : 0
  });
  const policy = await getEvolutionSendingPolicy(deviceId);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    instanceName: row.instance_name,
    displayName: row.display_name || row.device_name || row.instance_name,
    storeId: row.store_id,
    storeName: row.store_name || row.tenant_name,
    phoneNumber: maskAdminDevicePhone(row.phone_number, canViewFullPhone),
    status: normalizeAdminDeviceStatus(row.status),
    statusLabel: adminDeviceStatusLabel(row.status),
    platform: "Evolution / WhatsApp Baileys",
    model: row.device_name || "—",
    createdAt: row.created_at,
    connectedAt: row.connected_at,
    lastSeenAt: row.last_health_check_at || row.last_send_at || row.updated_at,
    webhookStatus: row.last_error ? "يحتاج متابعة" : "مهيأ",
    apiStatus: row.connection_state || "—",
    provider: "evolution_admin",
    risk,
    policy,
    metrics: deviceMessageMetrics(metricResult.rows[0]),
    activity: activity.rows
  };
}

export async function createAdminEvolutionDevice({ storeId, displayName, phoneNumber = "", adminId = "" }) {
  const store = await query("SELECT id,tenant_id,name FROM stores WHERE id=$1 LIMIT 1", [storeId]);
  if (!store.rows[0]) throw Object.assign(new Error("Store not found"), { code: "store_not_found" });
  const instanceName = evolutionInstanceName(store.rows[0].tenant_id);
  const idempotencyKey = crypto.createHash("sha256").update(`${adminId}:${storeId}:${displayName}:${Date.now()}`).digest("hex");
  await evolutionAdminAdapter.createInstance({ instanceName, phoneNumber, idempotencyKey });
  let channel;
  try {
    channel = await createChannel({ tenantId: store.rows[0].tenant_id, instanceName, providerToken: null, qrBase64: null, provider: "evolution_admin" });
    await updateChannel(channel.id, store.rows[0].tenant_id, {
      displayName: String(displayName || "جهاز واتساب الإداري").trim().slice(0, 100),
      deviceName: String(displayName || "جهاز واتساب الإداري").trim().slice(0, 100),
      phoneNumber: String(phoneNumber || "").replace(/\D/g, "") || null,
      status: "not_connected"
    });
  } catch (error) {
    await evolutionAdminAdapter.deleteInstance({ instanceName }).catch(() => null);
    throw error;
  }
  return getAdminEvolutionDevice(channel.id, { admin: { adminRole: "super_admin", permissions: [] } });
}

export async function adminEvolutionDeviceAction({ deviceId, action, phoneNumber = "" }) {
  const device = await getAdminEvolutionDevice(deviceId, { admin: { adminRole: "super_admin", permissions: [] } });
  if (!device) throw Object.assign(new Error("Device not found"), { code: "device_not_found" });
  const instanceName = device.instanceName;
  if (action === "qr") {
    const result = await evolutionAdminAdapter.getQrCode({ instanceName });
    if (!result.qrCode) throw Object.assign(new Error("QR unavailable"), { code: "qr_unavailable" });
    await updateChannel(deviceId, device.tenantId, { status: "pending_qr", lastQrGeneratedAt: new Date() });
    return result;
  }
  if (action === "pairing_code") {
    const result = await evolutionAdminAdapter.generatePairingCode({ instanceName, phoneNumber });
    if (!result.pairingCode) throw Object.assign(new Error("Pairing code unavailable"), { code: "pairing_unavailable" });
    await updateChannel(deviceId, device.tenantId, { status: "pending_pairing", lastPairingCodeGeneratedAt: new Date(), phoneNumber: String(phoneNumber).replace(/\D/g, "") });
    return result;
  }
  if (action === "refresh") {
    const state = await evolutionAdminAdapter.getConnectionState({ instanceName });
    const raw = state?.instance?.state || state?.state || state?.status;
    const normalized = normalizeAdminDeviceStatus(raw);
    const databaseStatus = normalized === "logged_out" || normalized === "disabled" ? "disconnected" : normalized;
    await updateChannel(deviceId, device.tenantId, { status: databaseStatus, lastError: normalized === "error" ? "provider_state_error" : null });
    return { status: normalized, statusLabel: adminDeviceStatusLabel(normalized) };
  }
  if (action === "reconnect") {
    await evolutionAdminAdapter.restartInstance({ instanceName });
    await updateChannel(deviceId, device.tenantId, { status: "connecting", lastError: null });
    return { status: "connecting", statusLabel: adminDeviceStatusLabel("connecting") };
  }
  if (action === "logout") {
    await evolutionAdminAdapter.logoutInstance({ instanceName });
    await updateChannel(deviceId, device.tenantId, { status: "disconnected" });
    return { status: "logged_out", statusLabel: adminDeviceStatusLabel("logged_out") };
  }
  throw Object.assign(new Error("Unsupported device action"), { code: "unsupported_action" });
}

export async function deleteAdminEvolutionDevice(deviceId) {
  const device = await getAdminEvolutionDevice(deviceId, { admin: { adminRole: "super_admin", permissions: [] } });
  if (!device) throw Object.assign(new Error("Device not found"), { code: "device_not_found" });
  await evolutionAdminAdapter.deleteInstance({ instanceName: device.instanceName });
  await deleteChannel(device.id, device.tenantId);
  return { deleted: true };
}
