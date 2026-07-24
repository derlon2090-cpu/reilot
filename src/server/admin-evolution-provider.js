import { assertProviderAllowed } from "./admin-messaging.js";

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
  return evolutionAdminRequest(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({ number, text: String(text), delay: 0, linkPreview: false }),
    timeoutMs: 20_000
  });
}
