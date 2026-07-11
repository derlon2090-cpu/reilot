function config() {
  const baseUrl = String(process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!baseUrl) throw new Error("EVOLUTION_API_URL is missing");
  if (!apiKey) throw new Error("EVOLUTION_API_KEY is missing");
  return { baseUrl, apiKey };
}
async function request(path, init = {}) {
  const { baseUrl, apiKey } = config();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { apikey: apiKey, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(15_000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Evolution API ${response.status}: ${body?.message || "request failed"}`);
  return body;
}

export async function evolutionHealth() {
  const startedAt = Date.now();
  const body = await request("/server/ok").catch(() => request("/"));
  return { ok: true, latencyMs: Date.now() - startedAt, version: body?.version || body?.response?.version || null };
}

export function evolutionCreateInstance(instanceName) {
  const webhookBase = process.env.EVOLUTION_WEBHOOK_URL;
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
  const webhook = webhookBase && webhookSecret ? {
    enabled: true,
    url: `${webhookBase}${webhookBase.includes("?") ? "&" : "?"}secret=${encodeURIComponent(webhookSecret)}`,
    events: ["CONNECTION_UPDATE", "QRCODE_UPDATED", "MESSAGES_UPSERT"]
  } : undefined;
  return request("/instance/create", {
    method: "POST",
    body: JSON.stringify({ instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS", ...(webhook ? { webhook } : {}) })
  });
}

export function evolutionConnect(instanceName, phoneNumber) {
  const query = phoneNumber ? `?number=${encodeURIComponent(phoneNumber)}` : "";
  return request(`/instance/connect/${encodeURIComponent(instanceName)}${query}`);
}

export function evolutionConnectionState(instanceName) {
  return request(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
}

export function evolutionSendText(instanceName, number, text) {
  return request(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({ number, text, delay: Number(process.env.DEFAULT_MIN_DELAY_SECONDS || 20) * 1000, linkPreview: false })
  });
}

export function evolutionLogout(instanceName) {
  return request(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
}

export function evolutionDelete(instanceName) {
  return request(`/instance/delete/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
}
