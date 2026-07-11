import { encryptSecret } from "../lib/encryption.js";
import { query } from "./db.js";
import { randomToken } from "./security.js";

export function evolutionInstanceName(tenantId) {
  return `renewpilot-${String(tenantId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
}

export async function latestTenantChannel(tenantId) {
  const result = await query(
    `SELECT id, tenant_id AS "tenantId", channel_id AS "instanceName", phone_number AS "phoneNumber",
            display_name AS "displayName", status, qr_code_cache AS "qrBase64", connected_at AS "connectedAt",
            disconnected_at AS "disconnectedAt", last_health_check_at AS "lastHealthCheckAt", last_error AS "lastError"
       FROM whatsapp_channels WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  );
  return result.rows[0] || null;
}

export async function ownedChannel(id, tenantId) {
  const result = await query(
    `SELECT id, tenant_id AS "tenantId", channel_id AS "instanceName", phone_number AS "phoneNumber",
            display_name AS "displayName", status, qr_code_cache AS "qrBase64"
       FROM whatsapp_channels WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [id, tenantId]
  );
  return result.rows[0] || null;
}

export async function createChannel({ tenantId, instanceName, providerToken, qrBase64 }) {
  const encrypted = encryptSecret(providerToken || randomToken(32), process.env.ENCRYPTION_KEY);
  const result = await query(
    `INSERT INTO whatsapp_channels (tenant_id, provider, channel_id, channel_token_encrypted, status, qr_code_cache, warmup_started_at)
     VALUES ($1, 'evolution', $2, $3, 'pending_qr', $4, now())
     RETURNING id, tenant_id AS "tenantId", channel_id AS "instanceName", status`,
    [tenantId, instanceName, encrypted, qrBase64 || null]
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
