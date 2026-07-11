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

export function evolutionConnectionState(instanceName) {
  return request(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
}

export function evolutionSendText(instanceName, number, text) {
  return request(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({ number, text, delay: Number(process.env.DEFAULT_MIN_DELAY_SECONDS || 20) * 1000, linkPreview: false })
  });
}
