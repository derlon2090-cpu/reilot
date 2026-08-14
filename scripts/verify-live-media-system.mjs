import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { query, getPool } from "../src/server/db.js";
import { reconcileTenantStorageUsage } from "../src/server/tenant-storage.js";
import {
  completeAttachmentUpload,
  createAttachmentUpload,
  deleteAttachment
} from "../src/server/attachments/service.js";
import {
  createPrivateUpload,
  deletePrivateObjectsAndVerify,
  privateObjectExists
} from "../src/server/attachments/object-storage.js";
import { processAIAttachment } from "../src/server/ai/media-processing.js";
import { DeepSeekProvider } from "../src/server/ai/provider.js";
import {
  getAIEntitlementSummary,
  reserveAITokens,
  settleAITokenReservation
} from "../src/server/ai/entitlements.js";
import { reserveProviderQuota, settleProviderUsage } from "../src/server/ai/provider-accounting.js";

const REQUIRED_ENVIRONMENT = [
  "DATABASE_URL", "DEEPSEEK_API_KEY", "GEMINI_API_KEY", "DEEPGRAM_API_KEY",
  "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"
];

function assert(condition, code) {
  if (!condition) throw Object.assign(new Error(code), { code });
}

async function uploadPresigned(objectKey, bytes, contentType) {
  const upload = await createPrivateUpload({ objectKey, contentType, size: bytes.length });
  const response = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: bytes });
  assert(response.ok, "LIVE_UPLOAD_FAILED");
}

async function createImageAttachment(session, conversationId, bytes, suffix) {
  const created = await createAttachmentUpload(session, {
    conversationId,
    name: `synthetic-${suffix}.png`,
    mimeType: "image/png",
    size: bytes.length
  });
  const response = await fetch(created.upload.url, {
    method: created.upload.method,
    headers: created.upload.headers,
    body: bytes
  });
  assert(response.ok, "LIVE_ATTACHMENT_UPLOAD_FAILED");
  await completeAttachmentUpload(session, created.attachment.id);
  const row = await query(
    `SELECT id,object_key AS "objectKey" FROM ai_attachments WHERE id=$1 AND tenant_id=$2`,
    [created.attachment.id, session.tenantId]
  );
  return row.rows[0];
}

async function createAudioAttachment(session, conversationId, bytes) {
  const id = crypto.randomUUID();
  const objectKey = `production/chat/${session.tenantId}/${conversationId}/${id}.wav`;
  await uploadPresigned(objectKey, bytes, "audio/wav");
  await query(
    `INSERT INTO ai_attachments
      (id,tenant_id,user_id,conversation_id,object_key,original_name,mime_type,size_bytes,purpose,status,processing_status,duration_ms)
     VALUES($1,$2,$3,$4,$5,'synthetic-audio.wav','audio/wav',$6,'audio','ready','queued',0)`,
    [id, session.tenantId, session.userId, conversationId, objectKey, bytes.length]
  );
  return { id, objectKey };
}

async function addDerivedObject(attachment, bytes) {
  const derivedKey = `${attachment.objectKey}.derived.json`;
  await uploadPresigned(derivedKey, bytes, "application/json");
  await query("UPDATE ai_attachments SET derived_object_keys=$2 WHERE id=$1", [attachment.id, [derivedKey]]);
  return derivedKey;
}

async function verifyProviderRetry(session, attachmentId) {
  const ledger = await query(
    `SELECT provider,model,modality,provider_request_id AS "providerRequestId",idempotency_key AS "idempotencyKey",
            provider_usage_raw AS usage
       FROM ai_provider_usage_ledger
      WHERE tenant_id=$1 AND attachment_id=$2 AND status='confirmed'
      ORDER BY created_at DESC LIMIT 1`,
    [session.tenantId, attachmentId]
  );
  const row = ledger.rows[0];
  assert(row?.providerRequestId && row?.idempotencyKey, "LIVE_PROVIDER_LEDGER_MISSING");
  const variant = row.provider === "deepgram" ? "mip_opt_out" : "standard";
  const reservation = await reserveProviderQuota(session, {
    provider: row.provider,
    model: row.model,
    variant,
    estimatedUsage: row.usage
  });
  const duplicate = await settleProviderUsage(session, reservation.id, {
    provider: row.provider,
    model: row.model,
    variant,
    modality: row.modality,
    usage: row.usage,
    confirmed: true,
    providerRequestId: row.providerRequestId,
    idempotencyKey: row.idempotencyKey
  });
  assert(duplicate.idempotent === true, "LIVE_PROVIDER_RETRY_DEDUCTED");
  const count = await query(
    "SELECT count(*)::int AS count FROM ai_provider_usage_ledger WHERE tenant_id=$1 AND provider=$2 AND idempotency_key=$3",
    [session.tenantId, row.provider, row.idempotencyKey]
  );
  assert(count.rows[0]?.count === 1, "LIVE_PROVIDER_RETRY_LEDGER_DUPLICATED");
  return row.provider;
}

async function verifyDeepSeekAccounting(session, conversationId) {
  const provider = new DeepSeekProvider();
  const result = await provider.completeStructured({
    model: provider.modelFor("flash"),
    messages: [{ role: "user", content: "Respond only with: OK" }],
    maxTokens: 8,
    thinking: "disabled"
  });
  const usage = result.usage || {};
  const total = Number(usage.total_tokens || Number(usage.prompt_tokens || 0) + Number(usage.completion_tokens || 0));
  assert(String(result.message?.content || "").trim() === "OK", "LIVE_DEEPSEEK_RESPONSE_INVALID");
  assert(total > 0 && result.providerRequestId, "LIVE_DEEPSEEK_USAGE_INVALID");
  const idempotencyKey = `live-deepseek:${crypto.randomUUID()}`;
  const reservation = await reserveAITokens(session, { conversationId, requestedTokens: Math.max(128, total + 32) });
  const first = await settleAITokenReservation(session, reservation.id, {
    providerRequestId: result.providerRequestId,
    idempotencyKey,
    model: provider.modelFor("flash"),
    routingMode: "flash",
    usage
  });
  assert(first.idempotent === false && first.actualTokens > 0, "LIVE_DEEPSEEK_SETTLEMENT_FAILED");
  const retryReservation = await reserveAITokens(session, { conversationId, requestedTokens: Math.max(128, total + 32) });
  const retry = await settleAITokenReservation(session, retryReservation.id, {
    providerRequestId: result.providerRequestId,
    idempotencyKey,
    model: provider.modelFor("flash"),
    routingMode: "flash",
    usage
  });
  assert(retry.idempotent === true, "LIVE_DEEPSEEK_RETRY_DEDUCTED");
}

const missing = REQUIRED_ENVIRONMENT.filter((name) => !String(process.env[name] || "").trim());
if (process.env.LIVE_SYSTEM_TEST_CONFIRM !== "renvix-synthetic-only") {
  process.stderr.write(`${JSON.stringify({ ok: false, code: "LIVE_SYSTEM_TEST_CONFIRMATION_REQUIRED" })}\n`);
  process.exitCode = 1;
} else if (missing.length) {
  process.stderr.write(`${JSON.stringify({ ok: false, code: "LIVE_SYSTEM_ENVIRONMENT_INCOMPLETE", missing })}\n`);
  process.exitCode = 1;
} else {
  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const subscriptionId = crypto.randomUUID();
  const conversationId = crypto.randomUUID();
  const session = { tenantId, userId };
  const objectKeys = new Set();
  const attachmentIds = [];
  try {
    const plan = await query("SELECT id FROM platform_plans WHERE slug='professional' LIMIT 1");
    assert(plan.rows[0]?.id, "LIVE_TEST_PLAN_MISSING");
    await query("INSERT INTO tenants(id,name,slug,status) VALUES($1,'Renvix synthetic live verification',$2,'active')", [tenantId, `live-${tenantId}`]);
    await query(
      "INSERT INTO users(id,tenant_id,name,email,email_verified,role) VALUES($1,$2,'Synthetic Verification',$3,true,'owner')",
      [userId, tenantId, `live-${userId}@example.test`]
    );
    await query(
      `INSERT INTO platform_subscriptions(id,tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end)
       VALUES($1,$2,$3,'active','monthly',now()-interval '1 day',now()+interval '30 days')`,
      [subscriptionId, tenantId, plan.rows[0].id]
    );
    await query("INSERT INTO ai_conversations(id,tenant_id,user_id,title) VALUES($1,$2,$3,'Synthetic live verification')", [conversationId, tenantId, userId]);
    await getAIEntitlementSummary(session);
    await reconcileTenantStorageUsage(tenantId);
    const baselineStorage = await query("SELECT used_bytes AS bytes FROM tenant_storage_usage WHERE tenant_id=$1", [tenantId]);

    await verifyDeepSeekAccounting(session, conversationId);

    const fixtureRoot = path.resolve("tests/fixtures/media-eval");
    const imageBytes = await readFile(path.join(fixtureRoot, "images/01-arabic-interface.png"));
    const audioBytes = await readFile(path.join(fixtureRoot, "audio/03-ar-en-mixed.wav"));

    const image = await createImageAttachment(session, conversationId, imageBytes, "image-primary");
    attachmentIds.push(image.id); objectKeys.add(image.objectKey);
    const imageDerived = await addDerivedObject(image, Buffer.from('{"synthetic":true}', "utf8"));
    objectKeys.add(imageDerived);
    const imageResult = await processAIAttachment(session, image.id);
    assert(imageResult.processingStatus === "completed" && imageResult.analysis, "LIVE_GEMINI_PIPELINE_FAILED");
    assert(await verifyProviderRetry(session, image.id) === "gemini", "LIVE_GEMINI_LEDGER_FAILED");

    const geminiCountBeforeCache = await query(
      "SELECT count(*)::int AS count FROM ai_provider_usage_ledger WHERE tenant_id=$1 AND provider='gemini' AND status='confirmed'",
      [tenantId]
    );
    const cachedImage = await createImageAttachment(session, conversationId, imageBytes, "image-cache");
    attachmentIds.push(cachedImage.id); objectKeys.add(cachedImage.objectKey);
    const cacheResult = await processAIAttachment(session, cachedImage.id);
    const geminiCountAfterCache = await query(
      "SELECT count(*)::int AS count FROM ai_provider_usage_ledger WHERE tenant_id=$1 AND provider='gemini' AND status='confirmed'",
      [tenantId]
    );
    assert(cacheResult.processingStatus === "completed", "LIVE_MEDIA_CACHE_FAILED");
    assert(geminiCountBeforeCache.rows[0]?.count === geminiCountAfterCache.rows[0]?.count, "LIVE_MEDIA_CACHE_RECHARGED");

    const audio = await createAudioAttachment(session, conversationId, audioBytes);
    attachmentIds.push(audio.id); objectKeys.add(audio.objectKey);
    const audioDerived = await addDerivedObject(audio, Buffer.from('{"synthetic":true}', "utf8"));
    objectKeys.add(audioDerived);
    const audioResult = await processAIAttachment(session, audio.id, {
      dynamicTerms: ["WhatsApp", "API", "connected"],
      requiredTerms: ["WhatsApp", "API", "connected"]
    });
    assert(audioResult.processingStatus === "completed", "LIVE_DEEPGRAM_PIPELINE_FAILED");
    await verifyProviderRetry(session, audio.id);

    await reconcileTenantStorageUsage(tenantId);
    const storageWithAttachments = await query("SELECT used_bytes AS bytes FROM tenant_storage_usage WHERE tenant_id=$1", [tenantId]);
    for (const attachmentId of attachmentIds) await deleteAttachment(session, attachmentId);
    for (const key of objectKeys) assert(!(await privateObjectExists(key)), "LIVE_HARD_DELETE_R2_REMAINS");
    const [remainingAttachments, tombstones, sensitiveDerivatives] = await Promise.all([
      query("SELECT count(*)::int AS count FROM ai_attachments WHERE id=ANY($1::uuid[])", [attachmentIds]),
      query("SELECT count(*)::int AS count FROM attachment_deletion_tombstones WHERE attachment_id=ANY($1::uuid[])", [attachmentIds]),
      query(
        `SELECT count(*)::int AS count FROM ai_attachments
          WHERE id=ANY($1::uuid[]) AND (transcript IS NOT NULL OR vision_result IS NOT NULL OR content_sha256 IS NOT NULL)`,
        [attachmentIds]
      )
    ]);
    await reconcileTenantStorageUsage(tenantId);
    const storageAfterDelete = await query("SELECT used_bytes AS bytes FROM tenant_storage_usage WHERE tenant_id=$1", [tenantId]);
    assert(remainingAttachments.rows[0]?.count === 0, "LIVE_HARD_DELETE_DB_REMAINS");
    assert(sensitiveDerivatives.rows[0]?.count === 0, "LIVE_HARD_DELETE_DERIVATIVES_REMAIN");
    assert(tombstones.rows[0]?.count === attachmentIds.length, "LIVE_HARD_DELETE_TOMBSTONE_MISSING");
    assert(Number(storageWithAttachments.rows[0]?.bytes || 0) > Number(baselineStorage.rows[0]?.bytes || 0), "LIVE_STORAGE_QUOTA_NOT_RESERVED");
    assert(Number(storageAfterDelete.rows[0]?.bytes || 0) <= Number(baselineStorage.rows[0]?.bytes || 0), "LIVE_STORAGE_QUOTA_NOT_RELEASED");

    process.stdout.write(`${JSON.stringify({
      ok: true,
      deepseek: { response: "PASS", usage: "PASS", accounting: "PASS", retryIdempotency: "PASS" },
      r2Pipeline: { image: "PASS", audio: "PASS", derivedObjects: "PASS" },
      gemini: { processing: "PASS", accounting: "PASS", retryIdempotency: "PASS", cacheReuse: "PASS" },
      deepgram: { processing: "PASS", accounting: "PASS", retryIdempotency: "PASS" },
      hardDelete: { r2: "PASS", database: "PASS", derivatives: "PASS", quotaReleased: "PASS" }
    })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      code: String(error?.code || "LIVE_SYSTEM_TEST_FAILED"),
      message: "Synthetic live media verification failed. No secret, transcript, signed URL, object key, or customer data was logged."
    })}\n`);
    process.exitCode = 1;
  } finally {
    if (objectKeys.size) await deletePrivateObjectsAndVerify([...objectKeys]).catch(() => {});
    await query("DELETE FROM users WHERE id=$1", [userId]).catch(() => {});
    await query("DELETE FROM tenant_storage_usage WHERE tenant_id=$1", [tenantId]).catch(() => {});
    await query("DELETE FROM tenants WHERE id=$1", [tenantId]).catch(() => {});
    await getPool().end().catch(() => {});
  }
}
