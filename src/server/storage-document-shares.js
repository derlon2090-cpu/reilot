import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { getTenantStorageLimitState } from "./tenant-storage.js";
import { sanitizeStorageHtml, storagePayloadSize } from "./storage-center.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHARE_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const SHAREABLE_TYPES = new Set(["note", "custom"]);

function shareError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function shareKey() {
  const secret = String(process.env.STORAGE_SHARE_ENCRYPTION_KEY || process.env.STORAGE_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET || "").trim();
  if (secret.length < 24) throw shareError("SHARE_CONFIGURATION_UNAVAILABLE", "تعذر تهيئة مشاركة المستندات حاليًا.", 503);
  return crypto.createHash("sha256").update(`renvix-storage-share:${secret}`).digest();
}

function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", shareKey(), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return { v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

function decryptToken(envelope) {
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", shareKey(), Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw shareError("SHARE_LINK_UNAVAILABLE", "تعذر قراءة رابط المشاركة. أنشئ رابطًا جديدًا.", 503);
  }
}

export function isStorageShareToken(value) {
  return SHARE_TOKEN.test(String(value || ""));
}

export function hashStorageShareToken(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

export function normalizeStorageSharePermission(value) {
  if (value === "edit" || value === "view") return value;
  throw shareError("INVALID_SHARE_PERMISSION", "اختر صلاحية عرض فقط أو تعديل.");
}

function cleanTitle(value) {
  return String(value || "").trim().replace(/[\u0000-\u001f]/g, " ").slice(0, 180);
}

function publicDocument(row) {
  return {
    id: row.documentId,
    title: row.title,
    type: row.type,
    body: sanitizeStorageHtml(row.content?.body),
    owner: row.owner || "مستخدم Renvix",
    permission: row.permission,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: new Date(row.updatedAt).toISOString()
  };
}

export async function getStorageDocumentShare(session, documentId) {
  if (!UUID.test(String(documentId || ""))) throw shareError("DOCUMENT_NOT_FOUND", "المستند غير موجود.", 404);
  const result = await query(
    `SELECT s.permission,s.token_encrypted AS "tokenEncrypted",s.created_at AS "createdAt",s.updated_at AS "updatedAt",
            d.title,d.type
       FROM storage_documents d
       LEFT JOIN storage_document_shares s ON s.document_id=d.id AND s.revoked_at IS NULL
      WHERE d.id=$1 AND d.tenant_id=$2 AND d.deleted_at IS NULL LIMIT 1`,
    [documentId, session.tenantId]
  );
  const row = result.rows[0];
  if (!row) throw shareError("DOCUMENT_NOT_FOUND", "المستند غير موجود.", 404);
  if (!SHAREABLE_TYPES.has(row.type)) throw shareError("DOCUMENT_NOT_SHAREABLE", "لا يمكن مشاركة بيانات الحسابات أو الأكواد السرية برابط عام.", 403);
  if (!row.permission) return { active: false, shareable: true };
  return { active: true, permission: row.permission, token: decryptToken(row.tokenEncrypted), createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export async function saveStorageDocumentShare(session, documentId, input = {}) {
  if (!UUID.test(String(documentId || ""))) throw shareError("DOCUMENT_NOT_FOUND", "المستند غير موجود.", 404);
  const permission = normalizeStorageSharePermission(input.permission);
  return transaction(async (client) => {
    const document = await client.query(
      `SELECT id,type FROM storage_documents WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`,
      [documentId, session.tenantId]
    );
    const row = document.rows[0];
    if (!row) throw shareError("DOCUMENT_NOT_FOUND", "المستند غير موجود.", 404);
    if (!SHAREABLE_TYPES.has(row.type)) throw shareError("DOCUMENT_NOT_SHAREABLE", "لا يمكن مشاركة بيانات الحسابات أو الأكواد السرية برابط عام.", 403);
    const current = await client.query("SELECT id,token_encrypted AS \"tokenEncrypted\" FROM storage_document_shares WHERE document_id=$1 FOR UPDATE", [documentId]);
    const regenerate = input.regenerate === true || !current.rows[0];
    const token = regenerate ? crypto.randomBytes(32).toString("base64url") : decryptToken(current.rows[0].tokenEncrypted);
    const encrypted = encryptToken(token);
    await client.query(
      `INSERT INTO storage_document_shares(tenant_id,document_id,token_hash,token_encrypted,permission,created_by,revoked_at)
       VALUES($1,$2,$3,$4::jsonb,$5,$6,NULL)
       ON CONFLICT(document_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,token_encrypted=EXCLUDED.token_encrypted,
         permission=EXCLUDED.permission,revoked_at=NULL,updated_at=now()`,
      [session.tenantId, documentId, hashStorageShareToken(token), JSON.stringify(encrypted), permission, session.userId]
    );
    return { active: true, permission, token, regenerated: regenerate };
  });
}

export async function revokeStorageDocumentShare(session, documentId) {
  if (!UUID.test(String(documentId || ""))) throw shareError("DOCUMENT_NOT_FOUND", "المستند غير موجود.", 404);
  const result = await query(
    `UPDATE storage_document_shares s SET revoked_at=now(),updated_at=now()
      FROM storage_documents d WHERE s.document_id=d.id AND d.id=$1 AND d.tenant_id=$2 AND d.deleted_at IS NULL
      RETURNING s.id`,
    [documentId, session.tenantId]
  );
  if (!result.rows[0]) throw shareError("SHARE_NOT_FOUND", "رابط المشاركة غير موجود.", 404);
  return { active: false };
}

export async function getPublicStorageDocument(token) {
  if (!isStorageShareToken(token)) throw shareError("SHARE_NOT_FOUND", "رابط المشاركة غير صالح أو تم إيقافه.", 404);
  const result = await query(
    `SELECT d.id AS "documentId",d.title,d.type,d.content,d.created_at AS "createdAt",d.updated_at AS "updatedAt",
            s.permission,COALESCE(NULLIF(owner.name,''),'مستخدم Renvix') AS owner
       FROM storage_document_shares s JOIN storage_documents d ON d.id=s.document_id
       LEFT JOIN users owner ON owner.id=d.created_by
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND d.deleted_at IS NULL AND d.type IN ('note','custom') LIMIT 1`,
    [hashStorageShareToken(token)]
  );
  if (!result.rows[0]) throw shareError("SHARE_NOT_FOUND", "رابط المشاركة غير صالح أو تم إيقافه.", 404);
  void query("UPDATE storage_document_shares SET last_accessed_at=now(),access_count=access_count+1 WHERE token_hash=$1", [hashStorageShareToken(token)]).catch(() => {});
  return publicDocument(result.rows[0]);
}

export async function updatePublicStorageDocument(token, input = {}) {
  if (!isStorageShareToken(token)) throw shareError("SHARE_NOT_FOUND", "رابط المشاركة غير صالح أو تم إيقافه.", 404);
  return transaction(async (client) => {
    const result = await client.query(
      `SELECT d.id AS "documentId",d.tenant_id AS "tenantId",d.title,d.type,d.content,d.size_bytes AS "sizeBytes",
              d.created_at AS "createdAt",d.updated_at AS "updatedAt",s.permission,
              COALESCE(NULLIF(owner.name,''),'مستخدم Renvix') AS owner
         FROM storage_document_shares s JOIN storage_documents d ON d.id=s.document_id
         LEFT JOIN users owner ON owner.id=d.created_by
        WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND d.deleted_at IS NULL AND d.type IN ('note','custom') FOR UPDATE OF d,s`,
      [hashStorageShareToken(token)]
    );
    const row = result.rows[0];
    if (!row) throw shareError("SHARE_NOT_FOUND", "رابط المشاركة غير صالح أو تم إيقافه.", 404);
    if (row.permission !== "edit") throw shareError("SHARE_READ_ONLY", "هذا الرابط مخصص للعرض فقط.", 403);
    const submittedVersion = new Date(String(input.version || "")).getTime();
    if (!Number.isFinite(submittedVersion) || submittedVersion !== new Date(row.updatedAt).getTime()) {
      throw shareError("DOCUMENT_VERSION_CONFLICT", "تم تعديل الملف في مكان آخر. حدّث الصفحة قبل الحفظ.", 409);
    }
    const title = cleanTitle(input.title);
    if (!title) throw shareError("INVALID_DOCUMENT_TITLE", "أدخل عنوان الملف.");
    const body = sanitizeStorageHtml(input.body);
    const content = { ...(row.content || {}), body };
    const sizeBytes = storagePayloadSize({ title, type: row.type, body, timerEndsAt: content.timerEndsAt, timerDisplayMode: content.timerDisplayMode });
    const usage = await getTenantStorageLimitState(row.tenantId, client);
    const delta = sizeBytes - Number(row.sizeBytes || 0);
    if (!usage.isUnlimited && delta > Number(usage.remainingBytes || 0)) throw shareError("STORAGE_QUOTA_EXCEEDED", "مساحة مالك الملف غير كافية لحفظ التغييرات.", 403);
    const updated = await client.query(
      `UPDATE storage_documents SET title=$2,content=$3::jsonb,size_bytes=$4,updated_at=now() WHERE id=$1
       RETURNING updated_at AS "updatedAt"`,
      [row.documentId, title, JSON.stringify(content), sizeBytes]
    );
    return publicDocument({ ...row, title, content, updatedAt: updated.rows[0].updatedAt });
  });
}
