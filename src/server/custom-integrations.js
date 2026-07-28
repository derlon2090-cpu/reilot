import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { query, transaction } from "./db.js";
import { decryptSecret, encryptSecret } from "../lib/encryption.js";
import { safeErrorMessage, sha256 } from "./security.js";
import {
  commitUsage,
  PlanEntitlementError,
  releaseUsage,
  reserveUsage,
  requirePlanEntitlement
} from "./plan-entitlements.js";

export const CUSTOM_SCOPES = new Set([
  "customers:read", "customers:write",
  "subscriptions:read", "subscriptions:write",
  "renewals:read", "renewals:write",
  "messages:read", "messages:send",
  "payments:read", "payments:write",
  "campaigns:read", "events:write", "webhooks:manage"
]);

export const CUSTOM_EVENTS = new Set([
  "customer.created", "customer.updated",
  "subscription.created", "subscription.updated", "subscription.renewal_due",
  "subscription.renewed", "subscription.expired", "subscription.cancelled",
  "payment.succeeded", "payment.failed",
  "message.queued", "message.sent", "message.delivered", "message.read", "message.failed",
  "campaign.started", "campaign.completed", "campaign.failed",
  "invoice_link.created", "invoice_link.opened", "invoice_link.completed",
  "integration.test"
]);

export class CustomIntegrationConfigurationError extends Error {
  constructor() {
    super("Custom integration security configuration is unavailable");
    this.name = "CustomIntegrationConfigurationError";
    this.code = "CUSTOM_INTEGRATION_SECURITY_NOT_CONFIGURED";
  }
}

function securityValue(explicitName, purpose) {
  const explicitValue = String(process.env[explicitName] || "").trim();
  if (explicitValue.length >= 24) return explicitValue;

  // The dedicated values are preferred. A domain-separated value derived from
  // the platform encryption/auth secret keeps existing installations operable
  // without ever storing or exposing that root secret.
  const rootSecret = [
    process.env.ENCRYPTION_KEY,
    process.env.JWT_SECRET,
    process.env.BETTER_AUTH_SECRET
  ].map((value) => String(value || "").trim()).find((value) => value.length >= 24);

  if (!rootSecret) throw new CustomIntegrationConfigurationError();
  return crypto.createHmac("sha256", rootSecret).update(`renvix:${purpose}:v1`).digest("hex");
}

function apiPepper() {
  return securityValue("CUSTOM_API_KEY_PEPPER", "custom-api-key-pepper");
}

function encryptionKey() {
  return securityValue("CUSTOM_INTEGRATION_ENCRYPTION_KEY", "custom-webhook-encryption");
}

export function isCustomIntegrationConfigurationError(error) {
  return error instanceof CustomIntegrationConfigurationError
    || error?.code === "CUSTOM_INTEGRATION_SECURITY_NOT_CONFIGURED";
}

export function normalizeScopes(scopes) {
  return [...new Set((Array.isArray(scopes) ? scopes : []).map(String).filter((scope) => CUSTOM_SCOPES.has(scope)))];
}

export function createApiKey(environment = "live") {
  const env = String(environment).toLowerCase() === "test" ? "test" : "live";
  const publicKeyId = crypto.randomUUID().replaceAll("-", "");
  const secret = crypto.randomBytes(32).toString("base64url");
  const prefix = `rvx_${env}_${publicKeyId}`;
  const raw = `${prefix}_${secret}`;
  return {
    raw,
    publicKeyId,
    secret,
    environment: env,
    prefix,
    digest: crypto.createHmac("sha256", apiPepper()).update(secret).digest("hex")
  };
}

export function verifyApiKeyDigest(raw, digest) {
  const parsed = parseApiKey(raw);
  const supplied = Buffer.from(
    crypto.createHmac("sha256", apiPepper()).update(parsed?.secret || String(raw)).digest("hex"),
    "hex"
  );
  const expected = Buffer.from(String(digest || ""), "hex");
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

export function parseApiKey(raw) {
  const match = String(raw || "").match(/^rvx_(live|test)_([a-f0-9]{32})_([A-Za-z0-9_-]{40,})$/);
  if (!match) return null;
  return { environment: match[1], publicKeyId: match[2], secret: match[3] };
}

export function createWebhookSecret() {
  return `whsec_${crypto.randomBytes(32).toString("base64url")}`;
}

export function encryptWebhookSecret(secret) {
  return encryptSecret(secret, encryptionKey());
}

export function decryptWebhookSecret(payload) {
  return decryptSecret(payload, encryptionKey());
}

export function signWebhook({ secret, timestamp, rawBody }) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

function isPrivateV4(address) {
  const octets = address.split(".").map(Number);
  return octets[0] === 10
    || octets[0] === 127
    || octets[0] === 0
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127);
}

export function isPublicIp(address) {
  const family = net.isIP(address);
  if (family === 4) return !isPrivateV4(address);
  if (family === 6) {
    const value = address.toLowerCase();
    return value !== "::1" && value !== "::" && !value.startsWith("fc") && !value.startsWith("fd")
      && !value.startsWith("fe8") && !value.startsWith("fe9") && !value.startsWith("fea") && !value.startsWith("feb");
  }
  return false;
}

export async function validateWebhookUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  const localDev = process.env.NODE_ENV !== "production" && process.env.ALLOW_LOCAL_WEBHOOKS === "true";
  if (url.protocol !== "https:" && !(localDev && url.protocol === "http:")) {
    return { ok: false, reason: "https_required" };
  }
  if (url.username || url.password || url.port && !/^\d+$/.test(url.port)) return { ok: false, reason: "invalid_url" };
  const hostname = url.hostname.toLowerCase();
  if (["localhost", "0.0.0.0", "metadata.google.internal"].includes(hostname) || hostname.endsWith(".local")) {
    return { ok: false, reason: "private_address" };
  }
  const directIp = net.isIP(hostname) ? [hostname] : [];
  let addresses = directIp;
  if (!addresses.length) {
    try {
      addresses = (await dns.lookup(hostname, { all: true, verbatim: true })).map((item) => item.address);
    } catch {
      return { ok: false, reason: "dns_resolution_failed" };
    }
  }
  if (!addresses.length || addresses.some((address) => !isPublicIp(address))) return { ok: false, reason: "private_address" };
  return { ok: true, url: url.toString(), addresses };
}

export function retryDelaySeconds(attempt) {
  return [0, 60, 300, 900, 3600, 21600, 86400][Math.max(0, Math.min(6, Number(attempt) || 0))];
}

export function isRetryableWebhookStatus(status) {
  return [408, 409, 425, 429].includes(Number(status)) || Number(status) >= 500;
}

export async function authenticateCustomApi(req, requiredScope) {
  const requestId = req.headers.get("x-request-id")?.slice(0, 100) || `req_${crypto.randomBytes(12).toString("base64url")}`;
  const authorization = req.headers.get("authorization") || "";
  const raw = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!raw) return { ok: false, status: 401, code: "missing_api_key", requestId };
  const parsed = parseApiKey(raw);
  const legacyKey = !parsed && /^rvx_(live|test)_[A-Za-z0-9_-]{30,}$/.test(raw);
  if (!parsed && !legacyKey) {
    return { ok: false, status: 401, code: "invalid_api_key", requestId };
  }
  const prefix = legacyKey ? raw.slice(0, 18) : `rvx_${parsed.environment}_${parsed.publicKeyId}`;
  const result = await query(
    `SELECT k.id AS "apiKeyId", k.tenant_id AS "tenantId", k.integration_id AS "integrationId",
            k.key_digest AS "keyDigest", k.scopes, k.expires_at AS "expiresAt", k.revoked_at AS "revokedAt",
            k.environment,k.status,k.grace_expires_at AS "graceExpiresAt",
            i.status AS "integrationStatus"
       FROM custom_integration_api_keys k
       JOIN custom_integrations i ON i.id = k.integration_id AND i.tenant_id = k.tenant_id
      WHERE ${parsed ? "k.public_key_id = $1" : "k.key_prefix = $1"} LIMIT 5`,
    [parsed?.publicKeyId || prefix]
  );
  const auth = result.rows.find((row) => !row.revokedAt && verifyApiKeyDigest(raw, row.keyDigest));
  if (!auth || auth.expiresAt && new Date(auth.expiresAt) <= new Date()) {
    return { ok: false, status: 401, code: "invalid_api_key", requestId };
  }
  if (parsed && auth.environment !== parsed.environment) {
    return { ok: false, status: 401, code: "invalid_api_key", requestId };
  }
  if (["REVOKED", "EXPIRED"].includes(auth.status)) {
    return { ok: false, status: 401, code: "invalid_api_key", requestId };
  }
  if (auth.integrationStatus === "PAUSED" || auth.integrationStatus === "REVOKED") {
    return { ok: false, status: 403, code: "integration_paused", requestId };
  }
  const scopes = normalizeScopes(auth.scopes);
  if (requiredScope && !scopes.includes(requiredScope)) {
    return { ok: false, status: 403, code: "insufficient_scope", requestId };
  }
  const isWriteRequest = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  let generalUsageReserved = false;
  let writeUsageReserved = false;
  try {
    await requirePlanEntitlement(auth.tenantId, "api_access");
    await reserveUsage({ tenantId: auth.tenantId, featureKey: "api_requests_monthly", amount: 1 });
    generalUsageReserved = true;
    if (isWriteRequest) {
      await reserveUsage({ tenantId: auth.tenantId, featureKey: "api_write_requests_monthly", amount: 1 });
      writeUsageReserved = true;
    }
  } catch (error) {
    if (generalUsageReserved) {
      await releaseUsage({ tenantId: auth.tenantId, featureKey: "api_requests_monthly", amount: 1 });
    }
    if (error instanceof PlanEntitlementError) {
      return { ok: false, status: 403, code: error.reason, requestId, details: error.details };
    }
    throw error;
  }
  const limit = Math.max(10, Number(process.env.CUSTOM_API_RATE_LIMIT_PER_MINUTE || 120));
  const identifier = sha256(`${auth.apiKeyId}:${req.headers.get("x-forwarded-for") || "unknown"}`);
  const usage = await transaction(async (client) => {
    await client.query("DELETE FROM custom_api_rate_limit_hits WHERE created_at < now() - interval '2 minutes'");
    const count = await client.query(
      `SELECT count(*)::int AS count FROM custom_api_rate_limit_hits
        WHERE identifier_hash = $1 AND route_key = $2 AND created_at > now() - interval '1 minute'`,
      [identifier, new URL(req.url).pathname]
    );
    if (Number(count.rows[0].count) >= limit) return Number(count.rows[0].count);
    await client.query(
      "INSERT INTO custom_api_rate_limit_hits (identifier_hash, route_key) VALUES ($1, $2)",
      [identifier, new URL(req.url).pathname]
    );
    return Number(count.rows[0].count) + 1;
  });
  if (usage > limit) {
    await Promise.all([
      releaseUsage({ tenantId: auth.tenantId, featureKey: "api_requests_monthly", amount: 1 }),
      ...(writeUsageReserved
        ? [releaseUsage({ tenantId: auth.tenantId, featureKey: "api_write_requests_monthly", amount: 1 })]
        : [])
    ]);
    return { ok: false, status: 429, code: "rate_limit_exceeded", requestId, limit };
  }
  await Promise.all([
    query(
      `UPDATE custom_integration_api_keys
          SET last_used_at=now(),last_used_ip_hash=$2,request_count=request_count+1,updated_at=now()
        WHERE id=$1`,
      [auth.apiKeyId, identifier]
    ),
    query(
      `UPDATE custom_integrations
          SET last_success_at = now(),
              status = CASE WHEN status IN ('DRAFT','PARTIALLY_CONFIGURED') THEN 'ACTIVE' ELSE status END,
              updated_at = now()
        WHERE id = $1`,
      [auth.integrationId]
    ),
    commitUsage({ tenantId: auth.tenantId, featureKey: "api_requests_monthly", amount: 1 }),
    ...(isWriteRequest
      ? [commitUsage({ tenantId: auth.tenantId, featureKey: "api_write_requests_monthly", amount: 1 })]
      : [])
  ]);
  return { ok: true, ...auth, scopes, requestId, rateLimit: { limit, remaining: Math.max(0, limit - usage) } };
}

export function customApiError(auth, message, details) {
  const messages = {
    missing_api_key: "مفتاح API مطلوب.",
    invalid_api_key: "مفتاح API غير صالح أو تم إلغاؤه.",
    insufficient_scope: "لا يملك مفتاح API الصلاحية المطلوبة.",
    integration_paused: "التكامل متوقف حاليًا.",
    rate_limit_exceeded: "تم تجاوز الحد المسموح للطلبات. حاول لاحقًا.",
    validation_error: "بعض البيانات المرسلة غير صحيحة.",
    resource_not_found: "المورد غير موجود.",
    idempotency_conflict: "تم استخدام مفتاح منع التكرار مع طلب مختلف."
  };
  return Response.json({
    error: { code: auth.code, message: message || messages[auth.code] || "تعذر تنفيذ الطلب.", ...(details ? { details } : {}), request_id: auth.requestId }
  }, {
    status: auth.status || 400,
    headers: auth.limit ? { "Retry-After": "60", "X-RateLimit-Limit": String(auth.limit), "X-RateLimit-Remaining": "0" } : undefined
  });
}

export async function withIdempotency({ req, auth, routeKey, body, execute }) {
  const key = req.headers.get("idempotency-key")?.trim();
  if (!key) return customApiError({ ...auth, code: "validation_error", status: 400 }, "رأس Idempotency-Key مطلوب لعمليات الكتابة.");
  const requestHash = sha256(JSON.stringify(body));
  const reservation = await transaction(async (client) => {
    const existing = await client.query(
      `SELECT request_hash AS "requestHash", response_status AS "responseStatus", response_body AS "responseBody"
         FROM custom_api_idempotency
        WHERE integration_id = $1 AND route_key = $2 AND idempotency_key = $3 FOR UPDATE`,
      [auth.integrationId, routeKey, key]
    );
    if (existing.rows[0]) return existing.rows[0];
    await client.query(
      `INSERT INTO custom_api_idempotency
         (integration_id, tenant_id, idempotency_key, route_key, request_hash)
       VALUES ($1,$2,$3,$4,$5)`,
      [auth.integrationId, auth.tenantId, key, routeKey, requestHash]
    );
    return null;
  });
  if (reservation) {
    if (reservation.requestHash !== requestHash) {
      return customApiError({ ...auth, code: "idempotency_conflict", status: 409 });
    }
    if (reservation.responseBody) {
      return Response.json(reservation.responseBody, { status: reservation.responseStatus || 200, headers: { "Idempotency-Replayed": "true" } });
    }
    return customApiError({ ...auth, code: "resource_conflict", status: 409 }, "العملية بالمفتاح نفسه قيد التنفيذ.");
  }
  let outcome;
  try {
    outcome = await execute();
  } catch (error) {
    // A failed business operation must not leave a permanent in-flight lock.
    // The caller can safely retry with the same key after the transaction rolls back.
    await query(
      `DELETE FROM custom_api_idempotency
        WHERE integration_id = $1 AND route_key = $2 AND idempotency_key = $3
          AND response_body IS NULL`,
      [auth.integrationId, routeKey, key]
    ).catch(() => null);
    throw error;
  }
  await query(
    `UPDATE custom_api_idempotency
        SET response_status = $4, response_body = $5::jsonb, completed_at = now()
      WHERE integration_id = $1 AND route_key = $2 AND idempotency_key = $3`,
    [auth.integrationId, routeKey, key, outcome.status, JSON.stringify(outcome.body)]
  );
  return Response.json(outcome.body, { status: outcome.status });
}

export async function publishCustomEvent(client, { tenantId, integrationId, type, resourceType, resourceId, object }) {
  if (!CUSTOM_EVENTS.has(type)) return null;
  const envelope = {
    id: `evt_${crypto.randomBytes(16).toString("base64url")}`,
    type,
    api_version: "v1",
    created_at: new Date().toISOString(),
    data: { object }
  };
  const event = await client.query(
    `INSERT INTO custom_integration_events
       (integration_id, tenant_id, direction, event_type, external_event_id, resource_type, resource_id, payload, status)
     VALUES ($1,$2,'outbound',$3,$4,$5,$6,$7::jsonb,'queued') RETURNING id`,
    [integrationId, tenantId, type, envelope.id, resourceType, resourceId, JSON.stringify(envelope)]
  );
  const endpoints = await client.query(
    `SELECT id FROM custom_integration_webhook_endpoints
      WHERE integration_id = $1 AND tenant_id = $2 AND status IN ('enabled','error')
        AND event_types ? $3`,
    [integrationId, tenantId, type]
  );
  for (const endpoint of endpoints.rows) {
    await client.query(
      `INSERT INTO custom_integration_webhook_deliveries
         (endpoint_id,integration_id,tenant_id,event_id,event_type,payload,idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT (idempotency_key) DO NOTHING`,
      [endpoint.id, integrationId, tenantId, event.rows[0].id, type, JSON.stringify(envelope), `${endpoint.id}:${envelope.id}`]
    );
  }
  return envelope;
}

export async function deliverCustomWebhook(delivery) {
  const validUrl = await validateWebhookUrl(delivery.url);
  if (!validUrl.ok) throw Object.assign(new Error(validUrl.reason), { code: "unsafe_webhook_url", permanent: true });
  const secret = decryptWebhookSecret(delivery.signingSecretEncrypted);
  const rawBody = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signWebhook({ secret, timestamp, rawBody });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const started = Date.now();
    const response = await fetch(delivery.url, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        "x-renvix-event-id": delivery.payload.id,
        "x-renvix-timestamp": timestamp,
        "x-renvix-signature": `v1=${signature}`,
        "x-renvix-delivery-id": delivery.id
      },
      body: rawBody,
      signal: controller.signal
    });
    const reader = response.body?.getReader();
    let received = 0;
    const chunks = [];
    while (reader && received < 64 * 1024) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const remaining = 64 * 1024 - received;
      chunks.push(chunk.value.subarray(0, remaining));
      received += Math.min(chunk.value.byteLength, remaining);
      if (chunk.value.byteLength > remaining) break;
    }
    await reader?.cancel().catch(() => null);
    const preview = Buffer.concat(chunks.map((value) => Buffer.from(value))).toString("utf8").slice(0, 1000);
    return { ok: response.status >= 200 && response.status < 300, status: response.status, durationMs: Date.now() - started, preview, retryable: isRetryableWebhookStatus(response.status) };
  } catch (error) {
    return { ok: false, status: null, durationMs: 8000, preview: "", retryable: !error.permanent, error: safeErrorMessage(error) };
  } finally {
    clearTimeout(timer);
  }
}
