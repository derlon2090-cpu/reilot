import QRCode from "qrcode";

function config() {
  const baseUrl = String(process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!baseUrl) throw new Error("EVOLUTION_API_URL is missing");
  if (!apiKey) throw new Error("EVOLUTION_API_KEY is missing");
  return { baseUrl, apiKey };
}
async function request(path, init = {}) {
  const { baseUrl, apiKey } = config();
  const { timeoutMs = 15_000, ...fetchInit } = init;
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...fetchInit,
      headers: { apikey: apiKey, "Content-Type": "application/json", ...(fetchInit.headers || {}) },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    if (["AbortError", "TimeoutError"].includes(error?.name) || /timed?\s*out|timeout/i.test(String(error?.message || ""))) {
      const timeoutError = new Error(`Evolution request timed out after ${timeoutMs}ms`);
      timeoutError.code = "EVOLUTION_TIMEOUT";
      timeoutError.timeoutMs = timeoutMs;
      throw timeoutError;
    }
    if (error instanceof TypeError || /fetch failed|network|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/i.test(String(error?.message || ""))) {
      const unavailableError = new Error("Evolution API is unreachable");
      unavailableError.code = "EVOLUTION_UNREACHABLE";
      throw unavailableError;
    }
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message || body?.error || "request failed";
    const error = new Error(`Evolution API ${response.status}: ${providerMessage}`);
    error.status = response.status;
    error.providerMessage = String(providerMessage);
    if ([401, 403].includes(response.status)) error.code = "EVOLUTION_AUTH_FAILED";
    if (response.status === 404) error.code = "EVOLUTION_INSTANCE_NOT_FOUND";
    throw error;
  }
  return body;
}

export function isEvolutionInstanceMissing(error) {
  return error?.code === "EVOLUTION_INSTANCE_NOT_FOUND" || /Evolution API 404:/i.test(String(error?.message || ""));
}

export function isEvolutionAuthFailed(error) {
  return error?.code === "EVOLUTION_AUTH_FAILED" || /Evolution API (401|403):/i.test(String(error?.message || ""));
}

export function isEvolutionTimeout(error) {
  return error?.code === "EVOLUTION_TIMEOUT" || /Evolution request timed out/i.test(String(error?.message || ""));
}

export function isEvolutionUnreachable(error) {
  return error?.code === "EVOLUTION_UNREACHABLE" || /Evolution API is unreachable/i.test(String(error?.message || ""));
}

export function isEvolutionPairingUnsupported(error) {
  const message = String(error?.message || "");
  if (/Evolution API (404|501):/i.test(message)) return true;
  return /pairing(?: code)? (?:is )?not supported|unsupported pairing|feature (?:is )?not available/i.test(message);
}

export function isValidPairingCode(value) {
  if (typeof value !== "string") return false;
  const clean = value.trim();
  if (!clean || clean.startsWith("data:image") || clean.length > 30) return false;
  return /^[A-Za-z0-9-]{4,30}$/.test(clean);
}

export function extractEvolutionPairingCode(body) {
  const candidates = [
    body?.pairingCode,
    body?.pairing_code,
    body?.codePairing,
    body?.qrcode?.pairingCode,
    body?.qrcode?.pairing_code,
    body?.code?.pairingCode,
    body?.data?.pairingCode,
    body?.data?.qrcode?.pairingCode,
    body?.data?.code,
    body?.code
  ];
  const value = candidates.find(isValidPairingCode);
  return value ? String(value).trim() : null;
}

export function normalizeEvolutionQr(value) {
  const raw = String(value || "");
  const match = raw.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  const encoded = match ? match[2] : /^[A-Za-z0-9+/=]+$/.test(raw) ? raw : "";
  if (encoded.length < 1000) return null;
  const bytes = Buffer.from(encoded, "base64");
  const png = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!png && !jpeg) return null;
  return `data:image/${png ? "png" : "jpeg"};base64,${encoded}`;
}

export async function extractEvolutionQr(body) {
  const imageCandidates = [
    body?.qrcode?.base64,
    body?.base64,
    body?.data?.qrcode?.base64,
    body?.data?.base64
  ];
  for (const candidate of imageCandidates) {
    const normalized = normalizeEvolutionQr(candidate);
    if (normalized) return normalized;
  }

  const textCandidates = [
    body?.qrcode?.code,
    body?.data?.qrcode?.code,
    body?.data?.code,
    body?.code
  ];
  const qrText = textCandidates.find((value) => typeof value === "string" && value.trim().length > 30);
  if (!qrText) return null;
  const generated = await QRCode.toDataURL(qrText.trim(), {
    type: "image/png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 360
  });
  return normalizeEvolutionQr(generated);
}

export async function evolutionHealth() {
  const startedAt = Date.now();
  const body = await request("/server/ok").catch(() => request("/"));
  return { ok: true, latencyMs: Date.now() - startedAt, version: body?.version || body?.response?.version || null };
}

export function evolutionCreateInstance(instanceName, options = {}) {
  const qrcode = options.qrcode === true;
  const number = String(options.phoneNumber || "").replace(/\D/g, "");
  const webhookBase = process.env.EVOLUTION_WEBHOOK_URL;
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
  const webhook = webhookBase && webhookSecret ? {
    enabled: true,
    url: `${webhookBase}${webhookBase.includes("?") ? "&" : "?"}secret=${encodeURIComponent(webhookSecret)}`,
    events: ["CONNECTION_UPDATE", "QRCODE_UPDATED", "MESSAGES_UPSERT"]
  } : undefined;
  return request("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      qrcode,
      integration: "WHATSAPP-BAILEYS",
      ...(number ? { number } : {}),
      ...(webhook ? { webhook } : {})
    }),
    timeoutMs: 20_000
  });
}

export function evolutionConnect(instanceName, phoneNumber, timeoutMs = 20_000) {
  const query = phoneNumber ? `?number=${encodeURIComponent(phoneNumber)}` : "";
  return request(`/instance/connect/${encodeURIComponent(instanceName)}${query}`, { timeoutMs });
}

export async function evolutionPairingCode(instanceName, phoneNumber, timeoutMs = 20_000) {
  const body = await evolutionConnect(instanceName, phoneNumber, timeoutMs);
  return { body, pairingCode: extractEvolutionPairingCode(body) };
}

export function evolutionConnectionState(instanceName, timeoutMs = 15_000) {
  return request(`/instance/connectionState/${encodeURIComponent(instanceName)}`, { timeoutMs });
}

export async function evolutionInstanceDetails(instanceName) {
  const body = await request(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`);
  const instances = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
  return instances.find((item) => {
    const name = item?.name || item?.instanceName || item?.instance?.instanceName;
    return name === instanceName;
  }) || instances[0] || null;
}

export function evolutionSendText(instanceName, number, text) {
  const delayMs = Number(process.env.DEFAULT_MIN_DELAY_SECONDS || 20) * 1000;
  return request(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({ number, text, delay: delayMs, linkPreview: false }),
    timeoutMs: delayMs + 20_000
  });
}

export function evolutionLogout(instanceName) {
  return request(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
}

export function evolutionDelete(instanceName) {
  return request(`/instance/delete/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
}
