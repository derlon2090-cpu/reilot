import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { getTenantStorageLimitState } from "./tenant-storage.js";
import { sanitizeStorageHtml, storagePayloadSize } from "./storage-center.js";
import {
  decryptStorageShareToken,
  encryptStorageShareToken,
  hashStorageShareToken,
  isStorageShareToken,
  normalizeStorageSharePermission
} from "./storage-document-shares.js";
import { ensureStorageFolderShareSchema } from "./storage-folder-share-schema.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function folderShareError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function cleanTitle(value) {
  return String(value || "").trim().replace(/[\u0000-\u001f]/g, " ").slice(0, 180);
}

function publicDocument(row) {
  return {
    id: row.documentId,
    folderId: row.folderId,
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

async function assertFolderCanBeShared(session, folderId, runner = { query }) {
  const result = await runner.query(
    `WITH RECURSIVE ancestors AS (
       SELECT id,parent_id,is_system FROM storage_folders WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL
       UNION ALL
       SELECT parent.id,parent.parent_id,parent.is_system FROM storage_folders parent JOIN ancestors child ON child.parent_id=parent.id
        WHERE parent.tenant_id=$2 AND parent.deleted_at IS NULL
     )
     SELECT root.id,root.is_system AS "isSystem",
            EXISTS(SELECT 1 FROM ancestors JOIN storage_folder_locks lock ON lock.folder_id=ancestors.id AND lock.tenant_id=$2) AS locked
       FROM storage_folders root WHERE root.id=$1 AND root.tenant_id=$2 AND root.deleted_at IS NULL`,
    [folderId, session.tenantId]
  );
  const row = result.rows[0];
  if (!row) throw folderShareError("FOLDER_NOT_FOUND", "المجلد غير موجود.", 404);
  if (row.isSystem) throw folderShareError("SYSTEM_FOLDER_NOT_SHAREABLE", "لا يمكن مشاركة مجلد نظامي بالكامل.", 403);
  if (row.locked) throw folderShareError("LOCKED_FOLDER_NOT_SHAREABLE", "أزل حماية كلمة المرور من المجلد قبل إنشاء رابط عام.", 403);
  return row;
}

export async function getStorageFolderShare(session, folderId) {
  await ensureStorageFolderShareSchema();
  if (!UUID.test(String(folderId || ""))) throw folderShareError("FOLDER_NOT_FOUND", "المجلد غير موجود.", 404);
  await assertFolderCanBeShared(session, folderId);
  const result = await query(
    `SELECT share.permission,share.token_encrypted AS "tokenEncrypted",share.created_at AS "createdAt",share.updated_at AS "updatedAt"
       FROM storage_folders folder
       LEFT JOIN storage_folder_shares share ON share.folder_id=folder.id AND share.revoked_at IS NULL
      WHERE folder.id=$1 AND folder.tenant_id=$2 AND folder.deleted_at IS NULL LIMIT 1`,
    [folderId, session.tenantId]
  );
  const row = result.rows[0];
  if (!row?.permission) return { active: false, shareable: true };
  return { active: true, permission: row.permission, token: decryptStorageShareToken(row.tokenEncrypted), createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export async function saveStorageFolderShare(session, folderId, input = {}) {
  await ensureStorageFolderShareSchema();
  if (!UUID.test(String(folderId || ""))) throw folderShareError("FOLDER_NOT_FOUND", "المجلد غير موجود.", 404);
  const permission = normalizeStorageSharePermission(input.permission);
  return transaction(async (client) => {
    await assertFolderCanBeShared(session, folderId, client);
    const current = await client.query("SELECT id,token_encrypted AS \"tokenEncrypted\" FROM storage_folder_shares WHERE folder_id=$1 FOR UPDATE", [folderId]);
    const regenerate = input.regenerate === true || !current.rows[0];
    const token = regenerate ? crypto.randomBytes(32).toString("base64url") : decryptStorageShareToken(current.rows[0].tokenEncrypted);
    await client.query(
      `INSERT INTO storage_folder_shares(tenant_id,folder_id,token_hash,token_encrypted,permission,created_by,revoked_at)
       VALUES($1,$2,$3,$4::jsonb,$5,$6,NULL)
       ON CONFLICT(folder_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,token_encrypted=EXCLUDED.token_encrypted,
         permission=EXCLUDED.permission,revoked_at=NULL,updated_at=now()`,
      [session.tenantId, folderId, hashStorageShareToken(token), JSON.stringify(encryptStorageShareToken(token)), permission, session.userId]
    );
    return { active: true, permission, token, regenerated: regenerate };
  });
}

export async function revokeStorageFolderShare(session, folderId) {
  await ensureStorageFolderShareSchema();
  if (!UUID.test(String(folderId || ""))) throw folderShareError("FOLDER_NOT_FOUND", "المجلد غير موجود.", 404);
  const result = await query(
    `UPDATE storage_folder_shares share SET revoked_at=now(),updated_at=now()
      FROM storage_folders folder WHERE share.folder_id=folder.id AND folder.id=$1 AND folder.tenant_id=$2 AND folder.deleted_at IS NULL
      RETURNING share.id`,
    [folderId, session.tenantId]
  );
  if (!result.rows[0]) throw folderShareError("SHARE_NOT_FOUND", "رابط المشاركة غير موجود.", 404);
  return { active: false };
}

async function publicFolderShare(token, runner = { query }, { lock = false } = {}) {
  if (!isStorageShareToken(token)) throw folderShareError("SHARE_NOT_FOUND", "رابط المشاركة غير صالح أو تم إيقافه.", 404);
  const result = await runner.query(
    `SELECT share.folder_id AS "folderId",share.tenant_id AS "tenantId",share.permission,
            folder.name,folder.description,folder.created_at AS "createdAt",folder.updated_at AS "updatedAt",
            COALESCE(NULLIF(owner.name,''),'مستخدم Renvix') AS owner
       FROM storage_folder_shares share JOIN storage_folders folder ON folder.id=share.folder_id
       LEFT JOIN users owner ON owner.id=folder.created_by
      WHERE share.token_hash=$1 AND share.revoked_at IS NULL AND folder.deleted_at IS NULL
        AND NOT EXISTS(SELECT 1 FROM storage_folder_locks lock WHERE lock.folder_id=folder.id AND lock.tenant_id=share.tenant_id)
      LIMIT 1 ${lock ? "FOR UPDATE OF share,folder" : ""}`,
    [hashStorageShareToken(token)]
  );
  if (!result.rows[0]) throw folderShareError("SHARE_NOT_FOUND", "رابط المشاركة غير صالح أو تم إيقافه.", 404);
  return result.rows[0];
}

export async function getPublicStorageFolder(token) {
  await ensureStorageFolderShareSchema();
  const share = await publicFolderShare(token);
  const [folders, documents, hidden] = await Promise.all([
    query(
      `WITH RECURSIVE tree AS (
         SELECT folder.id,folder.parent_id,folder.name,folder.description,0 AS depth
           FROM storage_folders folder WHERE folder.id=$1 AND folder.tenant_id=$2 AND folder.deleted_at IS NULL
         UNION ALL
         SELECT child.id,child.parent_id,child.name,child.description,parent.depth+1
           FROM storage_folders child JOIN tree parent ON child.parent_id=parent.id
          WHERE child.tenant_id=$2 AND child.deleted_at IS NULL
            AND NOT EXISTS(SELECT 1 FROM storage_folder_locks lock WHERE lock.folder_id=child.id AND lock.tenant_id=$2)
       ) SELECT id,parent_id AS "parentId",name,description,depth FROM tree ORDER BY depth,lower(name) LIMIT 250`,
      [share.folderId, share.tenantId]
    ),
    query(
      `WITH RECURSIVE tree AS (
         SELECT folder.id FROM storage_folders folder WHERE folder.id=$1 AND folder.tenant_id=$2 AND folder.deleted_at IS NULL
         UNION ALL
         SELECT child.id FROM storage_folders child JOIN tree parent ON child.parent_id=parent.id
          WHERE child.tenant_id=$2 AND child.deleted_at IS NULL
            AND NOT EXISTS(SELECT 1 FROM storage_folder_locks lock WHERE lock.folder_id=child.id AND lock.tenant_id=$2)
       )
       SELECT document.id,document.folder_id AS "folderId",document.title,document.type,
              document.created_at AS "createdAt",document.updated_at AS "updatedAt"
         FROM storage_documents document
        WHERE document.tenant_id=$2 AND document.folder_id IN (SELECT id FROM tree) AND document.deleted_at IS NULL
          AND document.type IN ('note','custom')
          AND NOT EXISTS(SELECT 1 FROM storage_document_locks lock WHERE lock.document_id=document.id AND lock.tenant_id=$2)
        ORDER BY document.updated_at DESC LIMIT 500`,
      [share.folderId, share.tenantId]
    ),
    query(
      `WITH RECURSIVE tree AS (
         SELECT id FROM storage_folders WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL
         UNION ALL SELECT child.id FROM storage_folders child JOIN tree parent ON child.parent_id=parent.id
          WHERE child.tenant_id=$2 AND child.deleted_at IS NULL
       )
       SELECT
         (SELECT count(*)::int FROM storage_documents document WHERE document.tenant_id=$2 AND document.folder_id IN (SELECT id FROM tree)
           AND document.deleted_at IS NULL AND (document.type NOT IN ('note','custom') OR EXISTS(SELECT 1 FROM storage_document_locks lock WHERE lock.document_id=document.id AND lock.tenant_id=$2)))
         +(SELECT count(*)::int FROM storage_assets asset WHERE asset.tenant_id=$2 AND asset.folder_id IN (SELECT id FROM tree) AND asset.deleted_at IS NULL) AS count`,
      [share.folderId, share.tenantId]
    )
  ]);
  void query("UPDATE storage_folder_shares SET last_accessed_at=now(),access_count=access_count+1 WHERE token_hash=$1", [hashStorageShareToken(token)]).catch(() => {});
  return {
    id: share.folderId,
    name: share.name,
    description: share.description || "",
    owner: share.owner,
    permission: share.permission,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt,
    folders: folders.rows,
    documents: documents.rows,
    hiddenItems: Number(hidden.rows[0]?.count || 0)
  };
}

async function publicFolderDocument(token, documentId, runner = { query }, { lock = false } = {}) {
  if (!UUID.test(String(documentId || ""))) throw folderShareError("DOCUMENT_NOT_FOUND", "المستند غير موجود داخل هذا المجلد.", 404);
  const share = await publicFolderShare(token, runner, { lock });
  const result = await runner.query(
    `WITH RECURSIVE tree AS (
       SELECT folder.id FROM storage_folders folder WHERE folder.id=$2 AND folder.tenant_id=$3 AND folder.deleted_at IS NULL
       UNION ALL
       SELECT child.id FROM storage_folders child JOIN tree parent ON child.parent_id=parent.id
        WHERE child.tenant_id=$3 AND child.deleted_at IS NULL
          AND NOT EXISTS(SELECT 1 FROM storage_folder_locks folder_lock WHERE folder_lock.folder_id=child.id AND folder_lock.tenant_id=$3)
     )
     SELECT document.id AS "documentId",document.folder_id AS "folderId",document.title,document.type,document.content,
            document.size_bytes AS "sizeBytes",document.created_at AS "createdAt",document.updated_at AS "updatedAt",
            $4::text AS permission,COALESCE(NULLIF(owner.name,''),'مستخدم Renvix') AS owner
       FROM storage_documents document LEFT JOIN users owner ON owner.id=document.created_by
      WHERE document.id=$1 AND document.tenant_id=$3 AND document.folder_id IN (SELECT id FROM tree)
        AND document.deleted_at IS NULL AND document.type IN ('note','custom')
        AND NOT EXISTS(SELECT 1 FROM storage_document_locks document_lock WHERE document_lock.document_id=document.id AND document_lock.tenant_id=$3)
      ${lock ? "FOR UPDATE OF document" : ""}`,
    [documentId, share.folderId, share.tenantId, share.permission]
  );
  if (!result.rows[0]) throw folderShareError("DOCUMENT_NOT_FOUND", "المستند غير موجود داخل هذا المجلد أو غير قابل للمشاركة.", 404);
  return { share, row: result.rows[0] };
}

export async function getPublicStorageFolderDocument(token, documentId) {
  await ensureStorageFolderShareSchema();
  const { row } = await publicFolderDocument(token, documentId);
  return publicDocument(row);
}

export async function updatePublicStorageFolderDocument(token, documentId, input = {}) {
  await ensureStorageFolderShareSchema();
  if (!isStorageShareToken(token)) throw folderShareError("SHARE_NOT_FOUND", "رابط المشاركة غير صالح أو تم إيقافه.", 404);
  return transaction(async (client) => {
    const { share, row } = await publicFolderDocument(token, documentId, client, { lock: true });
    if (share.permission !== "edit") throw folderShareError("SHARE_READ_ONLY", "هذا الرابط مخصص للعرض فقط.", 403);
    const submittedVersion = new Date(String(input.version || "")).getTime();
    if (!Number.isFinite(submittedVersion) || submittedVersion !== new Date(row.updatedAt).getTime()) {
      throw folderShareError("DOCUMENT_VERSION_CONFLICT", "تم تعديل المستند في مكان آخر. حدّث الصفحة قبل الحفظ.", 409);
    }
    const title = cleanTitle(input.title);
    if (!title) throw folderShareError("INVALID_DOCUMENT_TITLE", "أدخل عنوان المستند.");
    const body = sanitizeStorageHtml(input.body);
    const content = { ...(row.content || {}), body };
    const sizeBytes = storagePayloadSize({ title, type: row.type, body, timerEndsAt: content.timerEndsAt, timerDisplayMode: content.timerDisplayMode });
    const usage = await getTenantStorageLimitState(share.tenantId, client);
    const delta = sizeBytes - Number(row.sizeBytes || 0);
    if (!usage.isUnlimited && delta > Number(usage.remainingBytes || 0)) throw folderShareError("STORAGE_QUOTA_EXCEEDED", "مساحة مالك المجلد غير كافية لحفظ التغييرات.", 403);
    const updated = await client.query(
      `UPDATE storage_documents SET title=$2,content=$3::jsonb,size_bytes=$4,updated_at=now() WHERE id=$1
       RETURNING updated_at AS "updatedAt"`,
      [row.documentId, title, JSON.stringify(content), sizeBytes]
    );
    return publicDocument({ ...row, title, content, updatedAt: updated.rows[0].updatedAt });
  });
}
