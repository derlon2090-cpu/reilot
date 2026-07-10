import { decryptSecret, encryptSecret, redactSecrets } from "./encryption.js";

export async function createWhatsappChannel({ tenantId, env, whapi, repository }) {
  if (!env?.ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY is required");
  if (!env?.WHAPI_PARTNER_API_KEY) throw new Error("WHAPI_PARTNER_API_KEY is required");

  const created = await whapi.createChannel({ apiKey: env.WHAPI_PARTNER_API_KEY, tenantId });
  const saved = await repository.saveChannel({
    tenantId,
    channelId: created.channel_id,
    channelTokenEncrypted: encryptSecret(created.channel_token, env.ENCRYPTION_KEY),
    status: "pending_qr"
  });

  return redactSecrets({ id: saved.id, tenantId, channelId: saved.channelId, status: saved.status });
}

export async function getWhatsappQr({ tenantId, channelId, env, whapi, repository }) {
  const channel = await repository.getChannel(channelId);
  if (!channel || channel.tenantId !== tenantId) return { ok: false, status: 403 };

  const token = decryptSecret(channel.channelTokenEncrypted, env.ENCRYPTION_KEY);
  const qr = await whapi.getQr({ token });
  return { ok: true, qrBase64: qr.qrBase64, expiresAt: qr.expiresAt };
}

export async function updateWhatsappHealth({ channel, whapi, repository, env }) {
  const token = decryptSecret(channel.channelTokenEncrypted, env.ENCRYPTION_KEY);
  const health = await whapi.health({ token });
  return repository.updateChannel(channel.id, {
    status: health.status,
    lastError: health.error || null,
    lastHealthCheckAt: new Date().toISOString()
  });
}

export async function disconnectWhatsappChannel({ tenantId, channelId, repository }) {
  const channel = await repository.getChannel(channelId);
  if (!channel || channel.tenantId !== tenantId) return { ok: false, status: 403 };

  await repository.updateChannel(channelId, { status: "disconnected" });
  await repository.addActivity({ tenantId, type: "whatsapp.disconnected", title: "WhatsApp channel disconnected" });
  return { ok: true };
}

export function handleWebhookEvent({ event, secret, expectedSecret, repository }) {
  if (!expectedSecret || secret !== expectedSecret) {
    return { ok: false, status: 401 };
  }

  return repository.applyWebhook(event);
}
