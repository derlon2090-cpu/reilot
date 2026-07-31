import crypto from "node:crypto";
import { encryptSecret } from "../lib/encryption.js";
import { query } from "./db.js";
import { randomToken } from "./security.js";

export function evolutionInstanceName(tenantId) {
  const tenantShort = String(tenantId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "tenant";
  const unique = `${Date.now().toString(36)}${crypto.randomBytes(4).toString("hex")}`;
  return `rp_${tenantShort}_${unique}`;
}

export function withoutExpiredQr(channel, now = Date.now()) {
  if (!channel?.qrBase64) return channel;
  const generatedAt = new Date(channel.lastQrGeneratedAt || 0).getTime();
  const isFresh = Number.isFinite(generatedAt) && generatedAt > 0 && now - generatedAt < 60_000;
  return isFresh ? channel : { ...channel, qrBase64: null };
}

export async function latestTenantChannel(tenantId) {
  const result = await query(
    `SELECT id, tenant_id AS "tenantId", provider, instance_name AS "instanceName", phone_number AS "phoneNumber",
            display_name AS "displayName", device_name AS "deviceName", status, qr_code_cache AS "qrBase64",
            connected_at AS "connectedAt", disconnected_at AS "disconnectedAt",
            last_qr_generated_at AS "lastQrGeneratedAt", last_pairing_code_generated_at AS "lastPairingCodeGeneratedAt",
            last_health_check_at AS "lastHealthCheckAt", last_error AS "lastError", risk_score AS "riskScore"
       FROM whatsapp_channels WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  );
  return result.rows[0] || null;
}

/**
 * Returns the real messaging devices/channels owned by a tenant. Provider
 * secrets and QR material are deliberately excluded from this dashboard view.
 */
export async function tenantChannels(tenantId) {
  const result = await query(
    `SELECT id, provider, phone_number AS "phoneNumber", display_name AS "displayName",
            device_name AS "deviceName", status, connection_state AS "connectionState",
            last_health_check_at AS "lastHealthCheckAt", last_send_at AS "lastSendAt",
            connected_at AS "connectedAt", disconnected_at AS "disconnectedAt",
            last_error AS "lastError", daily_sent AS "messagesToday", created_at AS "createdAt",
            updated_at AS "updatedAt"
       FROM whatsapp_channels
      WHERE tenant_id=$1
      ORDER BY created_at DESC`,
    [tenantId]
  );
  return result.rows.map((item, index) => ({
    ...item,
    isPrimary: index === 0,
    requiresAttention: item.status === "error" || Boolean(item.lastError)
  }));
}

export async function recentDeviceActivity(tenantId, limit = 8) {
  const safeLimit = Math.min(20, Math.max(1, Number(limit) || 8));
  const result = await query(
    `SELECT id,type,title,created_at AS "createdAt",
            metadata->>'deviceId' AS "deviceId",
            metadata->>'deviceName' AS "deviceName",
            metadata->>'status' AS status,
            COALESCE(metadata->>'source', CASE WHEN user_id IS NULL THEN 'system' ELSE 'user' END) AS source
       FROM activity_logs
      WHERE tenant_id=$1
        AND (type LIKE 'whatsapp.%' OR type LIKE 'evolution.%' OR type LIKE 'device.%'
             OR type LIKE 'webhook.%' OR type LIKE 'api_key.%')
      ORDER BY created_at DESC
      LIMIT $2`,
    [tenantId, safeLimit]
  );
  return result.rows;
}

export async function ownedChannel(id, tenantId) {
  const result = await query(
    `SELECT id, tenant_id AS "tenantId", provider, instance_name AS "instanceName", phone_number AS "phoneNumber",
            display_name AS "displayName", device_name AS "deviceName", status, qr_code_cache AS "qrBase64", risk_score AS "riskScore"
       FROM whatsapp_channels WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [id, tenantId]
  );
  return result.rows[0] || null;
}

export async function createChannel({ tenantId, instanceName, providerToken, qrBase64 }) {
  const encrypted = encryptSecret(providerToken || randomToken(32), process.env.ENCRYPTION_KEY);
  const status = qrBase64 ? "pending_qr" : "not_connected";
  const result = await query(
    `INSERT INTO whatsapp_channels (tenant_id, provider, channel_id, instance_name, channel_token_encrypted, status, qr_code_cache, last_qr_generated_at, warmup_started_at)
     VALUES ($1, 'evolution', $2, $2, $3, $4, $5, CASE WHEN $5::text IS NOT NULL THEN now() END, now())
     RETURNING id, tenant_id AS "tenantId", instance_name AS "instanceName", status`,
    [tenantId, instanceName, encrypted, status, qrBase64 || null]
  );
  return result.rows[0];
}

export async function updateChannel(id, tenantId, patch) {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (!entries.length) return ownedChannel(id, tenantId);
  const names = {
    status: "status",
    qrBase64: "qr_code_cache",
    phoneNumber: "phone_number",
    displayName: "display_name",
    deviceName: "device_name",
    lastQrGeneratedAt: "last_qr_generated_at",
    lastPairingCodeGeneratedAt: "last_pairing_code_generated_at",
    riskScore: "risk_score",
    lastError: "last_error"
  };
  const sets = entries.map(([key], index) => `${names[key]} = $${index + 3}`);
  sets.push("updated_at = now()", "last_health_check_at = now()");
  if (patch.status === "connected") sets.push("connected_at = COALESCE(connected_at, now())");
  if (patch.status === "disconnected") sets.push("disconnected_at = now()", "last_disconnect_at = now()");
  await query(`UPDATE whatsapp_channels SET ${sets.join(", ")} WHERE id = $1 AND tenant_id = $2`, [id, tenantId, ...entries.map(([, value]) => value)]);
  return ownedChannel(id, tenantId);
}

export async function deleteChannel(id, tenantId) {
  return query("DELETE FROM whatsapp_channels WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
}

export async function addWhatsAppActivity({ tenantId, userId, type, title, metadata = {} }) {
  await query(
    "INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata) VALUES ($1, $2, $3, $4, $5)",
    [tenantId, userId || null, type, title, JSON.stringify(metadata)]
  );
}
