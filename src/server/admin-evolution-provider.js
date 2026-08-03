import { assertProviderAllowed } from "./admin-messaging.js";
import { extractEvolutionPairingCode, extractEvolutionQr } from "./evolution-client.js";

function configuration() {
  assertProviderAllowed({ scope: "platform_admin", provider: "evolution" });
  const baseUrl = String(process.env.EVOLUTION_ADMIN_API_URL || "").replace(/\/$/, "");
  const apiKey = String(process.env.EVOLUTION_ADMIN_API_KEY || "");
  const instanceName = String(process.env.EVOLUTION_ADMIN_INSTANCE || "");
  if (!baseUrl || !apiKey) {
    const error = new Error("Evolution Admin is not configured");
    error.code = "EVOLUTION_ADMIN_NOT_CONFIGURED";
    throw error;
  }
  return { baseUrl, apiKey, instanceName };
}

async function evolutionAdminRequest(path, init = {}) {
  const { baseUrl, apiKey } = configuration();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { apikey: apiKey, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(init.timeoutMs || 15_000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Evolution Admin request failed (${response.status})`);
    error.code = response.status === 401 || response.status === 403 ? "EVOLUTION_ADMIN_AUTH_FAILED" : "EVOLUTION_ADMIN_REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return body;
}

function cleanInstanceName(value) {
  const name = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(name)) {
    const error = new Error("Invalid Evolution instance name");
    error.code = "EVOLUTION_ADMIN_INVALID_INSTANCE";
    throw error;
  }
  return name;
}

function cleanPhone(value) {
  const number = String(value || "").replace(/\D/g, "");
  if (number && !/^\d{8,15}$/.test(number)) {
    const error = new Error("Invalid pairing phone number");
    error.code = "EVOLUTION_ADMIN_INVALID_PHONE";
    throw error;
  }
  return number;
}

function adminWebhookConfig() {
  const baseUrl = String(process.env.EVOLUTION_ADMIN_WEBHOOK_URL || process.env.EVOLUTION_WEBHOOK_URL || "").trim();
  const secret = String(process.env.EVOLUTION_ADMIN_WEBHOOK_SECRET || process.env.EVOLUTION_WEBHOOK_SECRET || "").trim();
  if (!baseUrl || !secret) return null;
  return {
    enabled: true,
    url: `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}secret=${encodeURIComponent(secret)}`,
    webhookByEvents: false,
    webhookBase64: false,
    events: ["CONNECTION_UPDATE", "QRCODE_UPDATED", "SEND_MESSAGE", "MESSAGES_UPSERT", "MESSAGES_UPDATE"]
  };
}

/**
 * Server-only adapter for the platform-owned Evolution Admin connection.
 * Provider credentials never leave this module and ephemeral pairing material
 * is returned to the requesting administrator without being persisted.
 */
export class EvolutionAdminAdapter {
  async createInstance({ instanceName, phoneNumber = "", idempotencyKey = "" }) {
    const name = cleanInstanceName(instanceName);
    const number = cleanPhone(phoneNumber);
    const webhook = adminWebhookConfig();
    const created = await evolutionAdminRequest("/instance/create", {
      method: "POST",
      headers: idempotencyKey ? { "Idempotency-Key": String(idempotencyKey).slice(0, 120) } : {},
      body: JSON.stringify({
        instanceName: name,
        integration: "WHATSAPP-BAILEYS",
        qrcode: false,
        ...(number ? { number } : {}),
        ...(webhook ? { webhook } : {})
      }),
      timeoutMs: 20_000
    });
    if (webhook) await this.configureWebhook({ instanceName: name });
    return created;
  }

  connectInstance({ instanceName, phoneNumber = "" }) {
    const name = cleanInstanceName(instanceName);
    const number = cleanPhone(phoneNumber);
    const suffix = number ? `?number=${encodeURIComponent(number)}` : "";
    return evolutionAdminRequest(`/instance/connect/${encodeURIComponent(name)}${suffix}`, { timeoutMs: 20_000 });
  }

  async getQrCode({ instanceName }) {
    const body = await this.connectInstance({ instanceName });
    return { qrCode: await extractEvolutionQr(body), expiresIn: 60 };
  }

  async generatePairingCode({ instanceName, phoneNumber }) {
    const body = await this.connectInstance({ instanceName, phoneNumber });
    return { pairingCode: extractEvolutionPairingCode(body), expiresIn: 60 };
  }

  getConnectionState({ instanceName }) {
    return evolutionAdminRequest(`/instance/connectionState/${encodeURIComponent(cleanInstanceName(instanceName))}`);
  }

  async fetchInstanceDetails({ instanceName }) {
    const name = cleanInstanceName(instanceName);
    const body = await evolutionAdminRequest(`/instance/fetchInstances?instanceName=${encodeURIComponent(name)}`);
    const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
    return rows.find((row) => (row?.name || row?.instanceName || row?.instance?.instanceName) === name) || rows[0] || null;
  }

  logoutInstance({ instanceName }) {
    return evolutionAdminRequest(`/instance/logout/${encodeURIComponent(cleanInstanceName(instanceName))}`, { method: "DELETE" });
  }

  deleteInstance({ instanceName }) {
    return evolutionAdminRequest(`/instance/delete/${encodeURIComponent(cleanInstanceName(instanceName))}`, { method: "DELETE" });
  }

  restartInstance({ instanceName }) {
    return evolutionAdminRequest(`/instance/restart/${encodeURIComponent(cleanInstanceName(instanceName))}`, { method: "PUT" });
  }

  configureWebhook({ instanceName }) {
    const webhook = adminWebhookConfig();
    if (!webhook) return Promise.resolve({ skipped: true, reason: "webhook_not_configured" });
    return evolutionAdminRequest(`/webhook/set/${encodeURIComponent(cleanInstanceName(instanceName))}`, {
      method: "POST",
      body: JSON.stringify(webhook)
    });
  }

  sendTextMessage({ instanceName, to, text }) {
    const number = cleanPhone(to);
    if (!number || !String(text || "").trim()) {
      const error = new Error("A recipient and message are required");
      error.code = "EVOLUTION_ADMIN_INVALID_MESSAGE";
      throw error;
    }
    return evolutionAdminRequest(`/message/sendText/${encodeURIComponent(cleanInstanceName(instanceName))}`, {
      method: "POST",
      body: JSON.stringify({ number, text: String(text), delay: 0, linkPreview: false }),
      timeoutMs: 20_000
    });
  }

  async getInstanceMetrics({ instanceName }) {
    const details = await this.fetchInstanceDetails({ instanceName });
    return details?.metrics || details?.messageMetrics || null;
  }
}

export const evolutionAdminAdapter = new EvolutionAdminAdapter();

export async function adminEvolutionHealth() {
  const startedAt = Date.now();
  const body = await evolutionAdminRequest("/server/ok").catch(() => evolutionAdminRequest("/"));
  return { ok: true, responseTimeMs: Date.now() - startedAt, version: body?.version || body?.response?.version || null };
}

export async function sendAdminEvolutionText({ to, text }) {
  const { instanceName } = configuration();
  if (!instanceName) {
    const error = new Error("Evolution Admin instance is missing");
    error.code = "EVOLUTION_ADMIN_INSTANCE_MISSING";
    throw error;
  }
  const number = String(to || "").replace(/\D/g, "");
  if (!number || !String(text || "").trim()) {
    const error = new Error("A recipient and message are required");
    error.code = "EVOLUTION_ADMIN_INVALID_MESSAGE";
    throw error;
  }
  return evolutionAdminAdapter.sendTextMessage({ instanceName, to: number, text });
}
