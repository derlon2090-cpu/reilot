import crypto from "node:crypto";
import { query, transaction } from "../db.js";
import { getTenantStorageLimitState } from "../tenant-storage.js";
import {
  createPrivateDownload,
  createPrivateUpload,
  deletePrivateObject,
  deletePrivateObjectsAndVerify,
  inspectPrivateObject,
  readPrivateObjectPrefix,
  writePrivateObject
} from "./object-storage.js";
import { recordAttachmentMetric } from "./metrics.js";
import { reconcileTenantStorageUsage } from "../tenant-storage.js";

export const ATTACHMENT_ERROR_MESSAGES = Object.freeze({
  ATTACHMENT_TYPE_NOT_ALLOWED: "نوع الملف غير مدعوم.",
  ATTACHMENT_TOO_LARGE: "حجم الملف أكبر من الحد المسموح.",
  STORAGE_QUOTA_EXCEEDED: "المرفقات المحددة أكبر من المساحة المتبقية في باقتك.",
  ATTACHMENT_NOT_FOUND: "المرفق غير موجود.",
  ATTACHMENT_NOT_READY: "المرفق لم يصبح جاهزًا بعد.",
  ATTACHMENT_FORBIDDEN: "لا تملك صلاحية الوصول إلى هذا المرفق.",
  UPLOAD_VERIFICATION_FAILED: "تعذر التحقق من الملف المرفوع.",
  UPLOAD_SIZE_MISMATCH: "حجم الملف المرفوع لا يطابق الحجم المتوقع.",
  UPLOAD_MIME_MISMATCH: "نوع الملف المرفوع لا يطابق النوع المتوقع.",
  R2_UNAVAILABLE: "تخزين المرفقات غير متاح مؤقتًا."
});

const RULES = Object.freeze({
  "image/jpeg": { ext: "jpg", purpose: "image", maxBytes: 6 * 1024 * 1024, valid: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", purpose: "image", maxBytes: 6 * 1024 * 1024, valid: (b) => b[0] === 0x89 && b.subarray(1, 4).toString("ascii") === "PNG" },
  "image/webp": { ext: "webp", purpose: "image", maxBytes: 6 * 1024 * 1024, valid: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
  "audio/webm": { ext: "webm", purpose: "audio", maxBytes: 10 * 1024 * 1024, valid: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
  "audio/ogg": { ext: "ogg", purpose: "audio", maxBytes: 10 * 1024 * 1024, valid: (b) => b.subarray(0, 4).toString("ascii") === "OggS" },
  "audio/mp4": { ext: "m4a", purpose: "audio", maxBytes: 10 * 1024 * 1024, valid: (b) => b.subarray(4, 8).toString("ascii") === "ftyp" },
  "audio/mpeg": { ext: "mp3", purpose: "audio", maxBytes: 10 * 1024 * 1024, valid: (b) => b.subarray(0, 3).toString("ascii") === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  "application/pdf": { ext: "pdf", purpose: "document", maxBytes: 10 * 1024 * 1024, valid: (b) => b.subarray(0, 5).toString("ascii") === "%PDF-" },
  "text/plain": { ext: "txt", purpose: "document", maxBytes: 2 * 1024 * 1024, valid: (b) => !b.includes(0) }
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function attachmentError(code, status = 400) {
  return Object.assign(new Error(ATTACHMENT_ERROR_MESSAGES[code] || "تعذر معالجة المرفق."), { code, status });
}

function safeName(value) {
  return String(value || "attachment").replace(/[<>\r\n]/g, "_").slice(0, 160);
}

function publicAttachment(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.originalName,
    type: row.mimeType,
    size: Number(row.sizeBytes || 0),
    purpose: row.purpose,
    status: row.status,
    processingStatus: row.processingStatus,
    durationMs: Number(row.durationMs || 0),
    transcript: row.transcript || "",
    transcriptConfidence: row.transcriptConfidence == null ? null : Number(row.transcriptConfidence),
    analysis: row.visionResult || null,
    createdAt: row.createdAt
  };
}

const SELECT_COLUMNS = `id,conversation_id AS "conversationId",message_id AS "messageId",object_key AS "objectKey",original_name AS "originalName",mime_type AS "mimeType",
  size_bytes AS "sizeBytes",purpose,status,processing_status AS "processingStatus",duration_ms AS "durationMs",
  transcript,transcript_confidence AS "transcriptConfidence",vision_result AS "visionResult",
  processing_generation AS "processingGeneration",created_at AS "createdAt"`;

export async function createAttachmentUpload(session, input = {}) {
  const mimeType = String(input.mimeType || "").toLowerCase();
  const rule = RULES[mimeType];
  if (!rule) {
    await recordAttachmentMetric(session.tenantId, "mime_rejections").catch(() => {});
    throw attachmentError("ATTACHMENT_TYPE_NOT_ALLOWED");
  }
  const size = Math.floor(Number(input.size || 0));
  if (!size || size > rule.maxBytes) {
    await recordAttachmentMetric(session.tenantId, "size_rejections").catch(() => {});
    throw attachmentError("ATTACHMENT_TOO_LARGE");
  }
  const conversationId = String(input.conversationId || "");
  const id = crypto.randomUUID();
  const environment = process.env.NODE_ENV === "production" ? "production" : "staging";
  const objectKey = `${environment}/chat/${session.tenantId}/${conversationId}/${id}.${rule.ext}`;
  const storage = await getTenantStorageLimitState(session.tenantId);
  if (!storage.isUnlimited && size > Number(storage.remainingBytes || 0)) {
    await recordAttachmentMetric(session.tenantId, "quota_rejections").catch(() => {});
    throw attachmentError("STORAGE_QUOTA_EXCEEDED", 403);
  }

  const row = await transaction(async (client) => {
    await client.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [session.tenantId]);
    const reservations = await client.query(
      `SELECT COALESCE(sum(size_bytes),0)::bigint AS bytes FROM ai_attachments
        WHERE tenant_id=$1 AND created_at > now()-interval '1 hour'
          AND (status IN ('pending','uploading') OR (status IN ('ready','processing','processed') AND message_id IS NULL))`,
      [session.tenantId]
    );
    if (!storage.isUnlimited && size + Number(reservations.rows[0]?.bytes || 0) > Number(storage.remainingBytes || 0)) {
      await recordAttachmentMetric(session.tenantId, "quota_rejections").catch(() => {});
      throw attachmentError("STORAGE_QUOTA_EXCEEDED", 403);
    }
    const conversation = await client.query(
      "SELECT id FROM ai_conversations WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status <> 'deleted' FOR UPDATE",
      [conversationId, session.tenantId, session.userId]
    );
    if (!conversation.rows[0]) throw attachmentError("ATTACHMENT_NOT_FOUND", 404);
    const result = await client.query(
      `INSERT INTO ai_attachments(id,tenant_id,user_id,conversation_id,object_key,original_name,mime_type,size_bytes,purpose,status,processing_status,duration_ms)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'uploading','pending',$10) RETURNING ${SELECT_COLUMNS}`,
      [id, session.tenantId, session.userId, conversationId, objectKey, safeName(input.name), mimeType, size, rule.purpose,
        rule.purpose === "audio" ? Math.max(0, Math.min(5 * 60 * 1000, Number(input.durationMs || 0))) : null]
    );
    return result.rows[0];
  });
  const presignStartedAt = Date.now();
  const upload = await createPrivateUpload({ objectKey, contentType: mimeType, size });
  await Promise.all([
    recordAttachmentMetric(session.tenantId, "uploads_started", { value: size }),
    recordAttachmentMetric(session.tenantId, "r2_presign_latency", { value: Date.now() - presignStartedAt })
  ]).catch(() => {});
  return { attachment: publicAttachment(row), upload };
}

export async function completeAttachmentUpload(session, attachmentId) {
  const scoped = await query(
    `SELECT ${SELECT_COLUMNS} FROM ai_attachments WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND deleted_at IS NULL LIMIT 1`,
    [attachmentId, session.tenantId, session.userId]
  );
  const row = scoped.rows[0];
  if (!row) throw attachmentError("ATTACHMENT_NOT_FOUND", 404);
  if (["ready", "processing", "processed"].includes(row.status)) return publicAttachment(row);
  let inspected;
  const headStartedAt = Date.now();
  try { inspected = await inspectPrivateObject(row.objectKey); } catch {
    await recordAttachmentMetric(session.tenantId, "uploads_failed").catch(() => {});
    throw attachmentError("UPLOAD_VERIFICATION_FAILED", 409);
  }
  await recordAttachmentMetric(session.tenantId, "r2_head_latency", { value: Date.now() - headStartedAt }).catch(() => {});
  if (inspected.size !== Number(row.sizeBytes)) throw attachmentError("UPLOAD_SIZE_MISMATCH", 409);
  if (inspected.contentType !== row.mimeType) throw attachmentError("UPLOAD_MIME_MISMATCH", 409);
  const prefix = await readPrivateObjectPrefix(row.objectKey, 64).catch(() => Buffer.alloc(0));
  if (!RULES[row.mimeType]?.valid(prefix)) throw attachmentError("UPLOAD_MIME_MISMATCH", 409);
  const result = await query(
    `UPDATE ai_attachments SET status='ready',processing_status=CASE WHEN purpose IN ('image','audio') THEN 'queued' ELSE 'not_required' END,
       object_etag=$4,verified_at=now(),updated_at=now()
     WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status='uploading' RETURNING ${SELECT_COLUMNS}`,
    [attachmentId, session.tenantId, session.userId, inspected.etag]
  );
  await Promise.all([
    recordAttachmentMetric(session.tenantId, "uploads_completed"),
    recordAttachmentMetric(session.tenantId, "uploaded_bytes", { count: 0, value: inspected.size })
  ]).catch(() => {});
  return publicAttachment(result.rows[0] || row);
}

export async function uploadAttachmentBytes(session, attachmentId, body, contentType) {
  const row = await getAttachmentForUser(session, attachmentId, { requireReady: false });
  if (["ready", "processing", "processed"].includes(row.status)) return publicAttachment(row);
  if (row.status !== "uploading") throw attachmentError("ATTACHMENT_NOT_READY", 409);
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body || []);
  if (bytes.length !== Number(row.sizeBytes)) throw attachmentError("UPLOAD_SIZE_MISMATCH", 409);
  if (String(contentType || "").split(";", 1)[0].trim().toLowerCase() !== row.mimeType) {
    throw attachmentError("UPLOAD_MIME_MISMATCH", 409);
  }
  if (!RULES[row.mimeType]?.valid(bytes.subarray(0, 64))) throw attachmentError("UPLOAD_MIME_MISMATCH", 409);
  try {
    await writePrivateObject({ objectKey: row.objectKey, contentType: row.mimeType, body: bytes });
  } catch {
    await recordAttachmentMetric(session.tenantId, "uploads_failed").catch(() => {});
    throw attachmentError("R2_UNAVAILABLE", 503);
  }
  return completeAttachmentUpload(session, attachmentId);
}

export async function getAttachmentForUser(session, attachmentId, { requireReady = true } = {}) {
  if (!UUID_PATTERN.test(String(attachmentId || ""))) throw attachmentError("ATTACHMENT_NOT_FOUND", 404);
  const result = await query(
    `SELECT ${SELECT_COLUMNS} FROM ai_attachments WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND deleted_at IS NULL LIMIT 1`,
    [attachmentId, session.tenantId, session.userId]
  );
  const row = result.rows[0];
  if (!row) throw attachmentError("ATTACHMENT_NOT_FOUND", 404);
  if (requireReady && !["ready", "processing", "processed"].includes(row.status)) throw attachmentError("ATTACHMENT_NOT_READY", 409);
  return row;
}

export async function getAttachmentDownload(session, attachmentId, { download = false } = {}) {
  const row = await getAttachmentForUser(session, attachmentId);
  const safeInline = row.purpose === "image" || row.purpose === "audio";
  return createPrivateDownload(row.objectKey, {
    filename: row.originalName,
    disposition: download || !safeInline ? "attachment" : "inline"
  });
}

export async function deleteAttachment(session, attachmentId, { reconcileStorage = true } = {}) {
  if (!UUID_PATTERN.test(String(attachmentId || ""))) throw attachmentError("ATTACHMENT_NOT_FOUND", 404);
  const scoped = await query(
    `SELECT ${SELECT_COLUMNS},derived_object_keys AS "derivedObjectKeys",deleted_at AS "deletedAt" FROM ai_attachments
      WHERE id=$1 AND tenant_id=$2 AND user_id=$3 LIMIT 1`,
    [attachmentId, session.tenantId, session.userId]
  );
  const row = scoped.rows[0];
  if (!row) {
    const tombstone = await query(
      `SELECT attachment_id FROM attachment_deletion_tombstones
        WHERE attachment_id=$1 AND tenant_id=$2 AND user_id=$3 LIMIT 1`,
      [attachmentId, session.tenantId, session.userId]
    ).catch((error) => error?.code === "42P01" ? { rows: [] } : Promise.reject(error));
    if (tombstone.rows[0]) return { id: attachmentId, status: "deleted", idempotent: true };
    throw attachmentError("ATTACHMENT_NOT_FOUND", 404);
  }
  await query(
    `UPDATE ai_attachments SET status='deleting',deletion_requested_at=COALESCE(deletion_requested_at,now()),updated_at=now()
      WHERE id=$1 AND tenant_id=$2 AND user_id=$3`,
    [attachmentId, session.tenantId, session.userId]
  );
  const deleteStartedAt = Date.now();
  try {
    await deletePrivateObjectsAndVerify([row.objectKey, ...(row.derivedObjectKeys || [])]);
  } catch (error) {
    await query(
      `UPDATE ai_attachments SET failure_code=$4,updated_at=now()
        WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status='deleting'`,
      [attachmentId, session.tenantId, session.userId, String(error?.code || "R2_DELETE_FAILED").slice(0, 80)]
    ).catch(() => {});
    throw error;
  }
  await transaction(async (client) => {
    const locked = await client.query(
      `SELECT id,message_id AS "messageId",size_bytes AS "sizeBytes" FROM ai_attachments
        WHERE id=$1 AND tenant_id=$2 AND user_id=$3 FOR UPDATE`,
      [attachmentId, session.tenantId, session.userId]
    );
    if (!locked.rows[0]) return;
    if (locked.rows[0].messageId) {
      await client.query(
        `UPDATE ai_messages
            SET attachments=COALESCE((
              SELECT jsonb_agg(
                CASE WHEN item->>'id'=$4
                  THEN jsonb_build_object('id',$4,'status','deleted','deleted',true,'name','تم حذف المرفق')
                  ELSE item END ORDER BY ordinal
              ) FROM jsonb_array_elements(COALESCE(attachments,'[]'::jsonb)) WITH ORDINALITY entries(item,ordinal)
            ),'[]'::jsonb),updated_at=now()
          WHERE id=$1 AND tenant_id=$2 AND user_id=$3`,
        [locked.rows[0].messageId, session.tenantId, session.userId, attachmentId]
      );
    }
    await client.query(
      `INSERT INTO attachment_deletion_tombstones(attachment_id,tenant_id,user_id,freed_bytes)
       VALUES($1,$2,$3,$4) ON CONFLICT(attachment_id) DO NOTHING`,
      [attachmentId, session.tenantId, session.userId, Number(locked.rows[0].sizeBytes || 0)]
    );
    await client.query(
      `DELETE FROM ai_attachments WHERE id=$1 AND tenant_id=$2 AND user_id=$3`,
      [attachmentId, session.tenantId, session.userId]
    );
  });
  await Promise.allSettled([
    recordAttachmentMetric(session.tenantId, "r2_delete_latency", { value: Date.now() - deleteStartedAt }),
    recordAttachmentMetric(session.tenantId, "hard_delete_completed", { value: Number(row.sizeBytes || 0) })
  ]);
  if (reconcileStorage) await reconcileTenantStorageUsage(session.tenantId);
  return { id: attachmentId, status: "deleted", idempotent: false };
}

export async function resolveMessageAttachments(session, conversationId, items = []) {
  const ids = [...new Set((Array.isArray(items) ? items : []).map((item) => String(item?.id || "")).filter((id) => UUID_PATTERN.test(id)))].slice(0, 3);
  if (!ids.length) return [];
  const result = await query(
    `SELECT ${SELECT_COLUMNS} FROM ai_attachments
      WHERE id = ANY($1::uuid[]) AND conversation_id=$2 AND tenant_id=$3 AND user_id=$4
        AND status IN ('ready','processing','processed') AND deleted_at IS NULL`,
    [ids, conversationId, session.tenantId, session.userId]
  );
  const byId = new Map(result.rows.map((row) => [row.id, publicAttachment(row)]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export async function linkAttachmentsToMessage(session, conversationId, messageId, items = []) {
  const ids = (Array.isArray(items) ? items : []).map((item) => String(item?.id || "")).filter(Boolean);
  if (!ids.length) return;
  await query(
    `UPDATE ai_attachments SET message_id=$5,updated_at=now()
      WHERE id = ANY($1::uuid[]) AND conversation_id=$2 AND tenant_id=$3 AND user_id=$4 AND deleted_at IS NULL`,
    [ids, conversationId, session.tenantId, session.userId, messageId]
  );
}

export async function deleteObjectsForConversation(session, conversationId) {
  const result = await query(
    `SELECT id FROM ai_attachments
      WHERE conversation_id=$1 AND tenant_id=$2 AND user_id=$3
      ORDER BY created_at,id`,
    [conversationId, session.tenantId, session.userId]
  );
  for (const row of result.rows) await deleteAttachment(session, row.id);
  return { deletedAttachments: result.rows.length };
}

export async function cleanupAbandonedAttachmentUploads() {
  let result;
  try {
    result = await query(
      `UPDATE ai_attachments
          SET status='expired',processing_status='failed',failure_code='UPLOAD_EXPIRED',deleted_at=now(),updated_at=now()
        WHERE status IN ('pending','uploading') AND deleted_at IS NULL
          AND created_at < now()-interval '1 hour'
        RETURNING tenant_id AS "tenantId",object_key AS "objectKey"`
    );
  } catch (error) {
    if (error?.code === "42P01") return { expiredUploads: 0, deletedObjects: 0, objectDeleteFailures: 0 };
    throw error;
  }
  const deletions = await Promise.allSettled(result.rows.map((row) => deletePrivateObject(row.objectKey)));
  const tenantCounts = result.rows.reduce((counts, row) => counts.set(row.tenantId, (counts.get(row.tenantId) || 0) + 1), new Map());
  await Promise.allSettled([...tenantCounts].map(([tenantId, count]) => recordAttachmentMetric(tenantId, "abandoned_uploads", { count })));
  return {
    expiredUploads: result.rowCount,
    deletedObjects: deletions.filter((item) => item.status === "fulfilled").length,
    objectDeleteFailures: deletions.filter((item) => item.status === "rejected").length
  };
}
