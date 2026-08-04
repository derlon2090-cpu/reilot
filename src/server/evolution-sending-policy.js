import crypto from "node:crypto";
import { query } from "./db.js";

export const DEFAULT_EVOLUTION_POLICY = Object.freeze({
  enabled: true,
  baseDelaySeconds: 300,
  jitterMinSeconds: 270,
  jitterMaxSeconds: 330,
  hourlyLimit: 20,
  dailyLimit: 100,
  batchLimit: 10,
  cooldownSeconds: 3600,
  duplicateWindowSeconds: 86400,
  stopOnHighRisk: true,
  reduceOnMediumRisk: true,
  blockNewCampaignsOnHighRisk: true,
  notifyAdminOnRisk: true,
  pauseOnDisconnect: true,
  validateTemplates: true,
  blockUnsafeLinks: true
});

const FIELD_MAP = Object.freeze({
  enabled: ["enabled", "boolean"],
  baseDelaySeconds: ["base_delay_seconds", "number", 1, 86400],
  jitterMinSeconds: ["jitter_min_seconds", "number", 0, 86400],
  jitterMaxSeconds: ["jitter_max_seconds", "number", 0, 86400],
  hourlyLimit: ["hourly_limit", "number", 1, 100000],
  dailyLimit: ["daily_limit", "number", 1, 1000000],
  batchLimit: ["batch_limit", "number", 1, 10000],
  cooldownSeconds: ["cooldown_seconds", "number", 0, 604800],
  duplicateWindowSeconds: ["duplicate_window_seconds", "number", 0, 2592000],
  stopOnHighRisk: ["stop_on_high_risk", "boolean"],
  reduceOnMediumRisk: ["reduce_on_medium_risk", "boolean"],
  blockNewCampaignsOnHighRisk: ["block_new_campaigns_on_high_risk", "boolean"],
  notifyAdminOnRisk: ["notify_admin_on_risk", "boolean"],
  pauseOnDisconnect: ["pause_on_disconnect", "boolean"],
  validateTemplates: ["validate_templates", "boolean"],
  blockUnsafeLinks: ["block_unsafe_links", "boolean"]
});

function serializePolicy(row = {}) {
  return Object.fromEntries(Object.entries(FIELD_MAP).map(([key, [column]]) => [key, row[column] ?? DEFAULT_EVOLUTION_POLICY[key]]));
}

function validatePatch(input = {}) {
  const patch = {};
  for (const [key, value] of Object.entries(input)) {
    const rule = FIELD_MAP[key];
    if (!rule) continue;
    if (rule[1] === "boolean") patch[key] = value === true;
    else {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < rule[2] || parsed > rule[3]) {
        throw Object.assign(new Error(`Invalid policy value: ${key}`), { code: "policy_validation_error" });
      }
      patch[key] = parsed;
    }
  }
  const merged = { ...DEFAULT_EVOLUTION_POLICY, ...patch };
  if (merged.jitterMinSeconds > merged.jitterMaxSeconds || merged.hourlyLimit > merged.dailyLimit) {
    throw Object.assign(new Error("Invalid policy limits"), { code: "policy_validation_error" });
  }
  return patch;
}

async function ownedEvolutionDevice(deviceId) {
  const result = await query(
    `SELECT id,instance_name,status,connection_state,risk_score,failure_rate,last_error,
            last_health_check_at,disconnected_at
       FROM whatsapp_channels
      WHERE id=$1 AND provider IN ('evolution_admin','evolution') LIMIT 1`,
    [deviceId]
  );
  return result.rows[0] || null;
}

export async function getEvolutionSendingPolicy(deviceId) {
  const device = await ownedEvolutionDevice(deviceId);
  if (!device) return null;
  const result = await query("SELECT * FROM evolution_sending_policies WHERE evolution_device_id=$1 LIMIT 1", [device.id]);
  return { deviceId: device.id, instanceId: device.instance_name, ...serializePolicy(result.rows[0] || {}) };
}

export async function updateEvolutionSendingPolicy(deviceId, input, adminId) {
  const existing = await getEvolutionSendingPolicy(deviceId);
  if (!existing) throw Object.assign(new Error("Device not found"), { code: "device_not_found" });
  const patch = validatePatch(input);
  if (!Object.keys(patch).length) return existing;
  await query(
    `INSERT INTO evolution_sending_policies(evolution_device_id,instance_id,updated_by_admin_id)
     VALUES($1,$2,$3) ON CONFLICT(evolution_device_id) DO NOTHING`,
    [deviceId, existing.instanceId, adminId || null]
  );
  const values = [deviceId, adminId || null];
  const sets = Object.entries(patch).map(([key, value]) => {
    values.push(value);
    return `${FIELD_MAP[key][0]}=$${values.length}`;
  });
  await query(
    `UPDATE evolution_sending_policies
        SET ${sets.join(",")},updated_by_admin_id=$2,updated_at=now()
      WHERE evolution_device_id=$1`,
    values
  );
  return getEvolutionSendingPolicy(deviceId);
}

export function calculateEvolutionRisk(signals = {}) {
  let score = 0;
  score += Math.min(35, Math.max(0, Number(signals.failureRate || 0)) * 35);
  score += Math.min(20, Math.max(0, Number(signals.disconnects24h || 0)) * 5);
  score += Math.min(15, Math.max(0, Number(signals.duplicateRatio || 0)) * 15);
  score += Math.min(10, Math.max(0, Number(signals.volumeSpikeRatio || 0) - 1) * 5);
  score += Math.min(10, Math.max(0, Number(signals.consecutiveProviderErrors || 0)) * 2);
  if (signals.webhookHealthy === false) score += 10;
  if (["logged_out", "error"].includes(String(signals.status || ""))) score += 35;
  score = Math.min(100, Math.round(score));
  const riskLevel = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  const action = riskLevel === "critical" ? "pause_device" : riskLevel === "high" ? "hold_batches" : riskLevel === "medium" ? "reduce_rate" : "continue";
  return { score, riskLevel, action };
}

export function evolutionDuplicateHash({ instanceId, recipient, content }) {
  return crypto.createHash("sha256").update(`${instanceId}|${recipient}|${content}`).digest("hex");
}

export function evolutionDelayedSchedule(policy, now = Date.now(), random = Math.random) {
  const min = Math.max(0, Number(policy.jitterMinSeconds));
  const max = Math.max(min, Number(policy.jitterMaxSeconds));
  const jittered = Math.round(min + (max - min) * Math.min(1, Math.max(0, random())));
  const delaySeconds = Math.max(Number(policy.baseDelaySeconds || 0), jittered);
  return { delaySeconds, scheduledFor: new Date(now + delaySeconds * 1000) };
}

export function validateEvolutionMessage({ destination, messageBody, policy }) {
  if (!/^\d{8,15}$/.test(String(destination || "").replace(/\D/g, ""))) return { ok: false, reason: "invalid_recipient" };
  const content = String(messageBody || "").trim();
  if (!content) return { ok: false, reason: "empty_message" };
  if (policy?.blockUnsafeLinks && /http:\/\//i.test(content)) return { ok: false, reason: "unsafe_link" };
  if (policy?.validateTemplates && /{{[^}]*$|^[^{]*}}/.test(content)) return { ok: false, reason: "invalid_template_variables" };
  return { ok: true };
}
