import { decryptSecret, encryptSecret, redactSecrets } from "./encryption.js";

function assertEvolutionEnv(env = {}) {
  if (!env.ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY is required");
  if (env.WHATSAPP_PROVIDER !== "evolution") throw new Error("WHATSAPP_PROVIDER must be evolution");
  if (!env.EVOLUTION_API_URL) throw new Error("EVOLUTION_API_URL is required");
  if (!env.EVOLUTION_API_KEY) throw new Error("EVOLUTION_API_KEY is required");
}

function instancePayload(instance, tenantId) {
  return redactSecrets({
    id: instance.id,
    tenantId,
    instanceId: instance.instanceId,
    instanceName: instance.instanceName,
    status: instance.status
  });
}

export async function createEvolutionInstance({ tenantId, env, evolution, repository }) {
  assertEvolutionEnv(env);

  const instanceName = `tenant-${tenantId}-whatsapp`;
  const created = await evolution.createInstance({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    tenantId,
    instanceName
  });

  const saved = await repository.saveInstance({
    tenantId,
    instanceId: created.instanceId,
    instanceName: created.instanceName || instanceName,
    instanceTokenEncrypted: encryptSecret(created.instanceToken, env.ENCRYPTION_KEY),
    status: "pending_qr"
  });

  return instancePayload(saved, tenantId);
}

export async function getEvolutionQr({ tenantId, instanceId, env, evolution, repository }) {
  assertEvolutionEnv(env);
  const instance = await repository.getInstance(instanceId);
  if (!instance || instance.tenantId !== tenantId) return { ok: false, status: 403 };

  const instanceToken = decryptSecret(instance.instanceTokenEncrypted, env.ENCRYPTION_KEY);
  const qr = await evolution.getQr({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instanceName: instance.instanceName,
    instanceToken
  });

  return { ok: true, qrBase64: qr.qrBase64, pairingCode: qr.pairingCode, expiresAt: qr.expiresAt };
}

export function normalizeEvolutionPhone(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  const value = /^05\d{8}$/.test(digits) ? `966${digits.slice(1)}` : digits;
  if (!/^[1-9]\d{10,14}$/.test(value)) {
    return { ok: false, status: 400, code: "INVALID_WHATSAPP_PHONE" };
  }
  return { ok: true, phoneNumber: value };
}

export async function requestEvolutionPairingCode({ tenantId, instanceId, phoneNumber, env, evolution, repository }) {
  assertEvolutionEnv(env);
  const normalized = normalizeEvolutionPhone(phoneNumber);
  if (!normalized.ok) return normalized;

  const instance = await repository.getInstance(instanceId);
  if (!instance || instance.tenantId !== tenantId) return { ok: false, status: 403 };
  if (typeof evolution.requestPairingCode !== "function") {
    return {
      ok: false,
      status: 501,
      code: "PAIRING_CODE_NOT_SUPPORTED",
      message: "رمز الاقتران غير مدعوم حاليا في نسخة Evolution API المثبتة. يمكنك استخدام الربط بالباركود."
    };
  }

  const result = await evolution.requestPairingCode({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instanceName: instance.instanceName,
    phoneNumber: normalized.phoneNumber
  });

  return {
    ok: true,
    pairingCode: result.pairingCode,
    expiresIn: result.expiresIn ?? 60,
    phoneNumber: normalized.phoneNumber
  };
}

export async function getEvolutionStatus({ tenantId, instanceId, env, evolution, repository }) {
  assertEvolutionEnv(env);
  const instance = await repository.getInstance(instanceId);
  if (!instance || instance.tenantId !== tenantId) return { ok: false, status: 403 };

  const result = await evolution.status({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instanceName: instance.instanceName
  });

  return { ok: true, status: result.status, phoneNumber: result.phoneNumber || null };
}

export async function sendEvolutionMessage({ tenantId, instanceId, to, message, env, evolution, repository }) {
  assertEvolutionEnv(env);
  const instance = await repository.getInstance(instanceId);
  if (!instance || instance.tenantId !== tenantId) return { ok: false, status: 403 };
  if (instance.status !== "connected") return { ok: false, status: 409, error: "instance_disconnected" };

  const sent = await evolution.sendMessage({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instanceName: instance.instanceName,
    to,
    message
  });

  await repository.addActivity({ tenantId, type: "evolution.message.sent", title: "WhatsApp test message sent" });
  return redactSecrets({ ok: true, providerMessageId: sent.messageId, status: sent.status });
}

export async function queueEvolutionTestMessage({ tenantId, instanceId, to, message, repository }) {
  const instance = await repository.getInstance(instanceId);
  if (!instance || instance.tenantId !== tenantId) return { ok: false, status: 403 };
  if (instance.status !== "connected") return { ok: false, status: 409, error: "instance_disconnected" };

  const queued = await repository.enqueueMessage({
    tenantId,
    instanceId,
    to,
    message,
    status: "pending",
    channel: "whatsapp"
  });

  return { ok: true, queuedMessageId: queued.id, status: "pending" };
}

export async function updateEvolutionHealth({ instance, evolution, repository, env }) {
  assertEvolutionEnv(env);
  const health = await evolution.health({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instanceName: instance.instanceName
  });

  return repository.updateInstance(instance.id, {
    status: health.status,
    lastError: health.error || null,
    lastHealthCheckAt: new Date().toISOString()
  });
}

export async function disconnectEvolutionInstance({ tenantId, instanceId, env, evolution, repository }) {
  assertEvolutionEnv(env);
  const instance = await repository.getInstance(instanceId);
  if (!instance || instance.tenantId !== tenantId) return { ok: false, status: 403 };

  await evolution.logout({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instanceName: instance.instanceName
  });
  await repository.updateInstance(instanceId, { status: "disconnected" });
  await repository.addActivity({ tenantId, type: "evolution.disconnected", title: "Evolution instance disconnected" });
  return { ok: true };
}

export async function deleteEvolutionInstance({ tenantId, instanceId, env, evolution, repository }) {
  assertEvolutionEnv(env);
  const instance = await repository.getInstance(instanceId);
  if (!instance || instance.tenantId !== tenantId) return { ok: false, status: 403 };

  await evolution.deleteInstance({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instanceName: instance.instanceName
  });
  await repository.deleteInstance(instanceId);
  await repository.addActivity({ tenantId, type: "evolution.deleted", title: "Evolution instance deleted" });
  return { ok: true };
}

export function handleEvolutionWebhookEvent({ event, secret, expectedSecret, repository }) {
  if (!expectedSecret || secret !== expectedSecret) {
    return { ok: false, status: 401 };
  }

  const unsubscribeKeywords = new Set(["إيقاف", "توقف", "stop", "unsubscribe"]);
  if (event?.type === "incoming_reply" && unsubscribeKeywords.has(String(event.text || "").trim().toLowerCase())) {
    return repository.applyWebhook({ ...event, type: "unsubscribe" });
  }

  return repository.applyWebhook(event);
}
