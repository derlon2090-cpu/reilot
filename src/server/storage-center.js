import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { getTenantStorageLimitState } from "./tenant-storage.js";
import {
  createPrivateDownload,
  createPrivateUpload,
  deletePrivateObject,
  deletePrivateObjectsAndVerify,
  inspectPrivateObject,
  readPrivateObjectPrefix
} from "./attachments/object-storage.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_TYPES = new Set(["note", "account", "code", "custom"]);
const IMAGE_RULES = Object.freeze({
  "image/jpeg": { extension: "jpg", valid: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { extension: "png", valid: (b) => b[0] === 0x89 && b.subarray(1, 4).toString("ascii") === "PNG" },
  "image/webp": { extension: "webp", valid: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" }
});

function storageImageMaxBytes() {
  return Math.max(1, Number(process.env.STORAGE_IMAGE_MAX_BYTES || 10 * 1024 * 1024));
}

function storageError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function cleanText(value, max = 180) {
  return String(value || "").trim().replace(/[\u0000-\u001f]/g, " ").slice(0, max);
}

function encryptionKey() {
  const value = String(process.env.STORAGE_ENCRYPTION_KEY || "").trim();
  let key;
  try { key = Buffer.from(value, "base64"); } catch { key = Buffer.alloc(0); }
  if (key.length !== 32) {
    throw storageError("STORAGE_ENCRYPTION_UNAVAILABLE", "تشفير بيانات مركز التخزين غير مهيأ حاليًا.", 503);
  }
  return key;
}

export function encryptStorageValue(value) {
  const plain = String(value || "");
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { v: 1, alg: "A256GCM", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") };
}

export function decryptStorageValue(envelope) {
  if (!envelope) return "";
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw storageError("STORAGE_DECRYPTION_FAILED", "تعذر فك تشفير البيانات المحفوظة.", 500);
  }
}

export function storagePayloadSize(payload) {
  return Buffer.byteLength(JSON.stringify(payload ?? {}), "utf8");
}

export function sanitizeStorageHtml(value) {
  return String(value || "")
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "")
    .slice(0, 500_000);
}

async function ensureImagesFolder(session, runner = { query }) {
  const result = await runner.query(
    `INSERT INTO storage_folders(tenant_id,name,system_type,is_system,created_by)
     VALUES($1,'الصور','images',true,$2) ON CONFLICT DO NOTHING
     RETURNING id`,
    [session.tenantId, session.userId]
  );
  if (result.rows[0]) return result.rows[0].id;
  let existing = await runner.query(
    `SELECT id FROM storage_folders WHERE tenant_id=$1 AND system_type='images' AND is_system=true AND deleted_at IS NULL LIMIT 1`,
    [session.tenantId]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  // Older installations may already contain a user-created root folder named
  // "الصور". Adopt it rather than leaving the tenant without its system folder.
  const adopted = await runner.query(
    `UPDATE storage_folders
        SET is_system=true,system_type='images',deleted_at=NULL,updated_at=now()
      WHERE id=(
        SELECT id FROM storage_folders
         WHERE tenant_id=$1 AND parent_id IS NULL AND lower(name)=lower('الصور')
         ORDER BY deleted_at NULLS FIRST,created_at ASC LIMIT 1
      )
        AND NOT EXISTS (
          SELECT 1 FROM storage_folders
           WHERE tenant_id=$1 AND system_type='images' AND is_system=true AND deleted_at IS NULL
        )
      RETURNING id`,
    [session.tenantId]
  );
  if (adopted.rows[0]) return adopted.rows[0].id;

  existing = await runner.query(
    `SELECT id FROM storage_folders WHERE tenant_id=$1 AND system_type='images' AND is_system=true AND deleted_at IS NULL LIMIT 1`,
    [session.tenantId]
  );
  if (!existing.rows[0]) throw storageError("IMAGES_FOLDER_UNAVAILABLE", "تعذر تهيئة مجلد الصور النظامي.", 500);
  return existing.rows[0].id;
}

async function requireFolder(session, folderId, runner = { query }) {
  if (!folderId) return null;
  if (!UUID.test(String(folderId))) throw storageError("FOLDER_NOT_FOUND", "المجلد غير موجود.", 404);
  const result = await runner.query(
    `SELECT id,name,is_system AS "isSystem",system_type AS "systemType",parent_id AS "parentId"
       FROM storage_folders WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL LIMIT 1`,
    [folderId, session.tenantId]
  );
  if (!result.rows[0]) throw storageError("FOLDER_NOT_FOUND", "المجلد غير موجود.", 404);
  return result.rows[0];
}

async function breadcrumbs(session, folderId, runner = { query }) {
  if (!folderId) return [];
  const result = await runner.query(
    `WITH RECURSIVE path AS (
       SELECT id,parent_id,name,0 AS depth FROM storage_folders WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL
       UNION ALL
       SELECT f.id,f.parent_id,f.name,path.depth+1 FROM storage_folders f JOIN path ON path.parent_id=f.id
        WHERE f.tenant_id=$2 AND f.deleted_at IS NULL
     ) SELECT id,name FROM path ORDER BY depth DESC`,
    [folderId, session.tenantId]
  );
  return result.rows;
}

function sortSql(sort) {
  return ({ oldest: "created_at ASC", name: "lower(name) ASC", size: "size_bytes DESC", modified: "updated_at DESC" })[sort] || "created_at DESC";
}

function folderSortSql(sort) {
  return ({ oldest: "f.created_at ASC", name: "lower(f.name) ASC", size: '"itemCount" DESC', modified: "f.updated_at DESC" })[sort] || "f.created_at DESC";
}

function documentSortSql(sort) {
  return ({ oldest: "created_at ASC", name: "lower(title) ASC", size: "size_bytes DESC", modified: "updated_at DESC" })[sort] || "created_at DESC";
}

async function signedAsset(row) {
  if (!row || row.status !== "ready") return row;
  const preview = await createPrivateDownload(row.storageKey, { filename: row.originalName, disposition: "inline" });
  return { ...row, previewUrl: preview.url, previewExpiresAt: preview.expiresAt };
}

export async function getStorageImageLibrary(session, input = {}) {
  const imagesFolderId = await ensureImagesFolder(session);
  const search = cleanText(input.search, 100).toLowerCase();
  const result = await query(
    `WITH RECURSIVE image_folders AS (
       SELECT id FROM storage_folders WHERE id=$2 AND tenant_id=$1 AND deleted_at IS NULL
       UNION ALL
       SELECT folder.id FROM storage_folders folder JOIN image_folders parent ON folder.parent_id=parent.id
        WHERE folder.tenant_id=$1 AND folder.deleted_at IS NULL
     )
     SELECT asset.id,asset.folder_id AS "folderId",asset.name,asset.original_name AS "originalName",asset.mime_type AS "mimeType",
            asset.size_bytes AS "sizeBytes",asset.storage_key AS "storageKey",asset.status,asset.created_at AS "createdAt",
            (SELECT count(*)::int FROM tenant_salla_template_images reference WHERE reference.tenant_id=asset.tenant_id AND reference.storage_asset_id=asset.id) AS "usedInCount"
       FROM storage_assets asset WHERE asset.tenant_id=$1 AND asset.folder_id IN (SELECT id FROM image_folders)
        AND asset.status='ready' AND asset.deleted_at IS NULL AND ($3='' OR lower(asset.name) LIKE '%'||$3||'%')
      ORDER BY asset.updated_at DESC LIMIT 200`,
    [session.tenantId, imagesFolderId, search]
  );
  return Promise.all(result.rows.map((row) => signedAsset(row).catch(() => row)));
}

export async function getStorageCenter(session, input = {}) {
  const folderId = input.folderId || null;
  const queryText = cleanText(input.search, 100).toLowerCase();
  if (folderId) await requireFolder(session, folderId);
  const imagesFolderId = await ensureImagesFolder(session);
  const [folderRows, allFolderRows, documentRows, assetRows, counts, recent, usage, trail] = await Promise.all([
    query(
      `SELECT f.id,f.parent_id AS "parentId",f.name,f.description,f.is_system AS "isSystem",f.system_type AS "systemType",f.updated_at AS "updatedAt",
              (SELECT count(*)::int FROM storage_folders c WHERE c.parent_id=f.id AND c.tenant_id=f.tenant_id AND c.deleted_at IS NULL)
              +(SELECT count(*)::int FROM storage_documents d WHERE d.folder_id=f.id AND d.tenant_id=f.tenant_id AND d.deleted_at IS NULL)
              +(SELECT count(*)::int FROM storage_assets a WHERE a.folder_id=f.id AND a.tenant_id=f.tenant_id AND a.deleted_at IS NULL AND a.status='ready') AS "itemCount"
         FROM storage_folders f
        WHERE f.tenant_id=$1 AND f.deleted_at IS NULL AND ($3<>'' OR f.parent_id IS NOT DISTINCT FROM $2::uuid)
          AND ($3='' OR lower(f.name) LIKE '%'||$3||'%') ORDER BY f.is_system DESC,${folderSortSql(input.sort)}`,
      [session.tenantId, folderId, queryText]
    ),
    query(
      `SELECT id,parent_id AS "parentId",name,is_system AS "isSystem",system_type AS "systemType"
         FROM storage_folders WHERE tenant_id=$1 AND deleted_at IS NULL ORDER BY is_system DESC,lower(name)`,
      [session.tenantId]
    ),
    query(
      `SELECT id,folder_id AS "folderId",title AS name,type,size_bytes AS "sizeBytes",is_favorite AS "isFavorite",created_at AS "createdAt",updated_at AS "updatedAt"
         FROM storage_documents WHERE tenant_id=$1 AND deleted_at IS NULL
          AND ($3<>'' OR (($2::uuid IS NULL AND folder_id IS NULL) OR folder_id=$2))
          AND ($3='' OR lower(title) LIKE '%'||$3||'%' OR EXISTS(
            SELECT 1 FROM storage_document_fields field WHERE field.document_id=storage_documents.id AND lower(field.label) LIKE '%'||$3||'%'
          ) OR EXISTS(
            SELECT 1 FROM storage_account_entries account WHERE account.document_id=storage_documents.id AND lower(account.account_name) LIKE '%'||$3||'%'
          )) ORDER BY ${documentSortSql(input.sort)} LIMIT 100`,
      [session.tenantId, folderId, queryText]
    ),
    query(
      `SELECT id,folder_id AS "folderId",name,original_name AS "originalName",mime_type AS "mimeType",extension,size_bytes AS "sizeBytes",storage_key AS "storageKey",width,height,status,created_at AS "createdAt",updated_at AS "updatedAt",
              (SELECT count(*)::int FROM tenant_salla_template_images reference WHERE reference.tenant_id=storage_assets.tenant_id AND reference.storage_asset_id=storage_assets.id) AS "usedInCount"
         FROM storage_assets WHERE tenant_id=$1 AND deleted_at IS NULL AND status='ready'
          AND ($3<>'' OR (($2::uuid IS NULL AND folder_id IS NULL) OR folder_id=$2))
          AND ($3='' OR lower(name) LIKE '%'||$3||'%') ORDER BY ${sortSql(input.sort)} LIMIT 100`,
      [session.tenantId, folderId, queryText]
    ),
    query(
      `SELECT
        (SELECT count(*)::int FROM storage_folders WHERE tenant_id=$1 AND deleted_at IS NULL) AS folders,
        (SELECT count(*)::int FROM storage_documents WHERE tenant_id=$1 AND deleted_at IS NULL) AS documents,
        (SELECT count(*)::int FROM storage_assets WHERE tenant_id=$1 AND deleted_at IS NULL AND status='ready') AS images,
        (SELECT count(*)::int FROM storage_activity WHERE tenant_id=$1 AND created_at>now()-interval '7 days') AS recent,
        (SELECT COALESCE(sum(size_bytes),0)::bigint FROM storage_assets WHERE tenant_id=$1 AND deleted_at IS NULL AND status IN ('uploading','ready')) AS "imageBytes",
        (SELECT COALESCE(sum(size_bytes),0)::bigint FROM storage_documents WHERE tenant_id=$1 AND deleted_at IS NULL) AS "documentBytes"`,
      [session.tenantId]
    ),
    query(
      `SELECT id,action,resource_type AS "resourceType",resource_id AS "resourceId",metadata,created_at AS "createdAt"
         FROM storage_activity WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 10`,
      [session.tenantId]
    ),
    getTenantStorageLimitState(session.tenantId),
    breadcrumbs(session, folderId)
  ]);
  const assets = await Promise.all(assetRows.rows.map((row) => signedAsset(row).catch(() => row)));
  return {
    folders: folderRows.rows,
    allFolders: allFolderRows.rows,
    documents: documentRows.rows,
    assets,
    counts: counts.rows[0] || {},
    activity: recent.rows,
    usage,
    breakdown: {
      images: Number(counts.rows[0]?.imageBytes || 0),
      documents: Number(counts.rows[0]?.documentBytes || 0),
      other: Math.max(0, Number(usage.usedBytes || 0) - Number(counts.rows[0]?.imageBytes || 0) - Number(counts.rows[0]?.documentBytes || 0))
    },
    breadcrumbs: trail,
    currentFolderId: folderId,
    imagesFolderId,
    limits: { imageMaxBytes: storageImageMaxBytes() }
  };
}

export async function createStorageFolder(session, input = {}) {
  const name = cleanText(input.name, 120);
  if (!name) throw storageError("INVALID_FOLDER_NAME", "أدخل اسم المجلد.");
  const parentId = input.parentId || null;
  if (parentId) await requireFolder(session, parentId);
  try {
    return await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO storage_folders(tenant_id,parent_id,name,description,created_by)
         VALUES($1,$2,$3,$4,$5) RETURNING id,parent_id AS "parentId",name,description,created_at AS "createdAt"`,
        [session.tenantId, parentId, name, cleanText(input.description, 500) || null, session.userId]
      );
      await client.query(
        `INSERT INTO storage_activity(tenant_id,user_id,action,resource_type,resource_id,metadata)
         VALUES($1,$2,'CREATE_FOLDER','folder',$3,$4::jsonb)`,
        [session.tenantId, session.userId, result.rows[0].id, JSON.stringify({ name })]
      );
      return result.rows[0];
    });
  } catch (error) {
    if (error?.code === "23505") throw storageError("FOLDER_EXISTS", "يوجد مجلد بهذا الاسم في الموقع نفسه.", 409);
    throw error;
  }
}

function documentPayload(input, type, title) {
  if (type === "account") return {
    title, type, email: String(input.email || ""), password: String(input.password || ""), code: String(input.code || ""),
    fields: (Array.isArray(input.fields) ? input.fields : []).slice(0, 50).map((field) => ({ label: cleanText(field.label, 100), value: String(field.value || "") })).filter((field) => field.label)
  };
  if (type === "code") return { title, type, code: String(input.code || ""), description: cleanText(input.description, 2000) };
  return { title, type, body: sanitizeStorageHtml(input.body) };
}

export async function createStorageDocument(session, input = {}) {
  const title = cleanText(input.title, 180);
  const type = String(input.type || "custom");
  if (!title) throw storageError("INVALID_DOCUMENT_TITLE", "أدخل اسم المستند.");
  if (!DOCUMENT_TYPES.has(type)) throw storageError("INVALID_DOCUMENT_TYPE", "نوع المستند غير صالح.");
  const folderId = input.folderId || null;
  if (folderId) await requireFolder(session, folderId);
  const payload = documentPayload(input, type, title);
  const sizeBytes = storagePayloadSize(payload);
  return transaction(async (client) => {
    await client.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [session.tenantId]);
    const usage = await getTenantStorageLimitState(session.tenantId, client);
    if (!usage.isUnlimited && sizeBytes > Number(usage.remainingBytes || 0)) throw storageError("STORAGE_QUOTA_EXCEEDED", "مساحة التخزين غير كافية.", 403);
    const content = type === "note" || type === "custom" ? { body: payload.body } : type === "code" ? { description: payload.description } : {};
    const result = await client.query(
      `INSERT INTO storage_documents(tenant_id,folder_id,title,type,content,size_bytes,created_by)
       VALUES($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING id,folder_id AS "folderId",title,type,size_bytes AS "sizeBytes",created_at AS "createdAt"`,
      [session.tenantId, folderId, title, type, JSON.stringify(content), sizeBytes, session.userId]
    );
    const document = result.rows[0];
    if (type === "account" || type === "code") {
      await client.query(
        `INSERT INTO storage_account_entries(document_id,account_name,email_encrypted,password_encrypted,code_encrypted)
         VALUES($1,$2,$3::jsonb,$4::jsonb,$5::jsonb)`,
        [document.id, title, JSON.stringify(encryptStorageValue(payload.email)), JSON.stringify(encryptStorageValue(payload.password)), JSON.stringify(encryptStorageValue(payload.code))]
      );
      for (const [position, field] of (payload.fields || []).entries()) {
        await client.query(
          `INSERT INTO storage_document_fields(document_id,label,value_encrypted,position) VALUES($1,$2,$3::jsonb,$4)`,
          [document.id, field.label, JSON.stringify(encryptStorageValue(field.value)), position]
        );
      }
    }
    await client.query(
      `INSERT INTO storage_activity(tenant_id,user_id,action,resource_type,resource_id,metadata)
       VALUES($1,$2,'CREATE_DOCUMENT','document',$3,$4::jsonb)`,
      [session.tenantId, session.userId, document.id, JSON.stringify({ title, type })]
    );
    return document;
  });
}

export async function getStorageDocument(session, documentId) {
  if (!UUID.test(String(documentId || ""))) throw storageError("DOCUMENT_NOT_FOUND", "المستند غير موجود.", 404);
  const result = await query(
    `SELECT d.id,d.folder_id AS "folderId",d.title,d.type,d.content,d.size_bytes AS "sizeBytes",d.created_at AS "createdAt",d.updated_at AS "updatedAt",
            a.email_encrypted AS "emailEncrypted",a.password_encrypted AS "passwordEncrypted",a.code_encrypted AS "codeEncrypted"
       FROM storage_documents d LEFT JOIN storage_account_entries a ON a.document_id=d.id
      WHERE d.id=$1 AND d.tenant_id=$2 AND d.deleted_at IS NULL LIMIT 1`,
    [documentId, session.tenantId]
  );
  const row = result.rows[0];
  if (!row) throw storageError("DOCUMENT_NOT_FOUND", "المستند غير موجود.", 404);
  const fields = await query(
    `SELECT f.id,f.label,f.value_encrypted AS "valueEncrypted",f.position FROM storage_document_fields f
      JOIN storage_documents d ON d.id=f.document_id WHERE f.document_id=$1 AND d.tenant_id=$2 ORDER BY f.position`,
    [documentId, session.tenantId]
  );
  return {
    id: row.id, folderId: row.folderId, title: row.title, type: row.type, content: row.content, sizeBytes: Number(row.sizeBytes || 0), createdAt: row.createdAt, updatedAt: row.updatedAt,
    email: decryptStorageValue(row.emailEncrypted), password: decryptStorageValue(row.passwordEncrypted), code: decryptStorageValue(row.codeEncrypted),
    fields: fields.rows.map((field) => ({ id: field.id, label: field.label, value: decryptStorageValue(field.valueEncrypted), position: field.position }))
  };
}

export async function updateStorageDocument(session, documentId, input = {}) {
  if (!UUID.test(String(documentId || ""))) throw storageError("DOCUMENT_NOT_FOUND", "المستند غير موجود.", 404);
  return transaction(async (client) => {
    await client.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [session.tenantId]);
    const existing = await client.query(
      `SELECT id,title,type,content,size_bytes AS "sizeBytes",folder_id AS "folderId" FROM storage_documents
        WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [documentId, session.tenantId]
    );
    const row = existing.rows[0];
    if (!row) throw storageError("DOCUMENT_NOT_FOUND", "المستند غير موجود.", 404);
    const title = cleanText(input.title ?? row.title, 180);
    if (!title) throw storageError("INVALID_DOCUMENT_TITLE", "أدخل اسم المستند.");
    const folderId = input.folderId === undefined ? row.folderId : input.folderId || null;
    if (folderId) await requireFolder(session, folderId, client);
    let previousSecrets = {};
    let previousFields = [];
    if (["account", "code"].includes(row.type)) {
      const secretResult = await client.query(
        `SELECT email_encrypted AS "emailEncrypted",password_encrypted AS "passwordEncrypted",code_encrypted AS "codeEncrypted"
           FROM storage_account_entries WHERE document_id=$1`, [documentId]
      );
      const secret = secretResult.rows[0] || {};
      previousSecrets = { email: decryptStorageValue(secret.emailEncrypted), password: decryptStorageValue(secret.passwordEncrypted), code: decryptStorageValue(secret.codeEncrypted) };
      const fieldResult = await client.query("SELECT label,value_encrypted AS \"valueEncrypted\" FROM storage_document_fields WHERE document_id=$1 ORDER BY position", [documentId]);
      previousFields = fieldResult.rows.map((field) => ({ label: field.label, value: decryptStorageValue(field.valueEncrypted) }));
    }
    const merged = documentPayload({
      ...input,
      email: input.email === undefined ? previousSecrets.email : input.email,
      password: input.password === undefined ? previousSecrets.password : input.password,
      code: input.code === undefined ? previousSecrets.code : input.code,
      fields: input.fields === undefined ? previousFields : input.fields,
      body: input.body === undefined ? row.content?.body : input.body,
      description: input.description === undefined ? row.content?.description : input.description
    }, row.type, title);
    const sizeBytes = storagePayloadSize(merged);
    const delta = sizeBytes - Number(row.sizeBytes || 0);
    const usage = await getTenantStorageLimitState(session.tenantId, client);
    if (!usage.isUnlimited && delta > Number(usage.remainingBytes || 0)) throw storageError("STORAGE_QUOTA_EXCEEDED", "مساحة التخزين غير كافية.", 403);
    const content = row.type === "note" || row.type === "custom" ? { body: merged.body } : row.type === "code" ? { description: merged.description } : {};
    await client.query(
      `UPDATE storage_documents SET folder_id=$3,title=$4,content=$5::jsonb,size_bytes=$6,updated_at=now()
        WHERE id=$1 AND tenant_id=$2`, [documentId, session.tenantId, folderId, title, JSON.stringify(content), sizeBytes]
    );
    if (["account", "code"].includes(row.type)) {
      await client.query(
        `UPDATE storage_account_entries SET account_name=$2,email_encrypted=$3::jsonb,password_encrypted=$4::jsonb,code_encrypted=$5::jsonb,updated_at=now()
          WHERE document_id=$1`, [documentId, title, JSON.stringify(encryptStorageValue(merged.email)), JSON.stringify(encryptStorageValue(merged.password)), JSON.stringify(encryptStorageValue(merged.code))]
      );
      await client.query("DELETE FROM storage_document_fields WHERE document_id=$1", [documentId]);
      for (const [position, field] of (merged.fields || []).entries()) {
        await client.query("INSERT INTO storage_document_fields(document_id,label,value_encrypted,position) VALUES($1,$2,$3::jsonb,$4)", [documentId, field.label, JSON.stringify(encryptStorageValue(field.value)), position]);
      }
    }
    await client.query(
      `INSERT INTO storage_activity(tenant_id,user_id,action,resource_type,resource_id,metadata)
       VALUES($1,$2,'UPDATE_DOCUMENT','document',$3,$4::jsonb)`, [session.tenantId, session.userId, documentId, JSON.stringify({ title, deltaBytes: delta })]
    );
    return { id: documentId, folderId, title, type: row.type, sizeBytes };
  });
}

export async function createStorageAssetUpload(session, input = {}) {
  const expired = await query(
    `DELETE FROM storage_assets WHERE tenant_id=$1 AND status='uploading' AND upload_expires_at<=now()
     RETURNING storage_key AS "storageKey"`,
    [session.tenantId]
  );
  if (expired.rows.length) {
    await Promise.allSettled(expired.rows.map((row) => deletePrivateObject(row.storageKey)));
  }
  const mimeType = String(input.mimeType || "").toLowerCase();
  const rule = IMAGE_RULES[mimeType];
  if (!rule) throw storageError("ASSET_TYPE_NOT_ALLOWED", "الصيغة المدعومة هي JPG أو PNG أو WEBP فقط.");
  const size = Math.floor(Number(input.size || 0));
  const maxBytes = storageImageMaxBytes();
  if (!size || size > maxBytes) throw storageError("ASSET_TOO_LARGE", `يجب ألا يتجاوز حجم الصورة ${Math.round(maxBytes / 1024 / 1024)} ميجابايت.`);
  const name = cleanText(input.name, 180) || `image.${rule.extension}`;
  const id = crypto.randomUUID();
  const folderId = input.folderId || await ensureImagesFolder(session);
  await requireFolder(session, folderId);
  const environment = process.env.NODE_ENV === "production" ? "production" : "staging";
  const objectKey = `${environment}/storage/${session.tenantId}/images/${id}.${rule.extension}`;
  const row = await transaction(async (client) => {
    await client.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [session.tenantId]);
    const usage = await getTenantStorageLimitState(session.tenantId, client);
    if (!usage.isUnlimited && size > Number(usage.remainingBytes || 0)) throw storageError("STORAGE_QUOTA_EXCEEDED", "مساحة التخزين غير كافية.", 403);
    const result = await client.query(
      `INSERT INTO storage_assets(id,tenant_id,folder_id,name,original_name,mime_type,extension,size_bytes,storage_key,status,upload_expires_at,created_by)
       VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8,'uploading',now()+interval '30 minutes',$9)
       RETURNING id,name,mime_type AS "mimeType",size_bytes AS "sizeBytes",status`,
      [id, session.tenantId, folderId, name, mimeType, rule.extension, size, objectKey, session.userId]
    );
    return result.rows[0];
  });
  try {
    return { asset: row, upload: await createPrivateUpload({ objectKey, contentType: mimeType, size }) };
  } catch (error) {
    await query("DELETE FROM storage_assets WHERE id=$1 AND tenant_id=$2 AND status='uploading'", [id, session.tenantId]).catch(() => {});
    throw error;
  }
}

export async function completeStorageAssetUpload(session, assetId) {
  if (!UUID.test(String(assetId || ""))) throw storageError("ASSET_NOT_FOUND", "الصورة غير موجودة.", 404);
  const result = await query(
    `SELECT id,name,original_name AS "originalName",mime_type AS "mimeType",size_bytes AS "sizeBytes",storage_key AS "storageKey",status,upload_expires_at AS "uploadExpiresAt"
       FROM storage_assets WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL LIMIT 1`,
    [assetId, session.tenantId]
  );
  const row = result.rows[0];
  if (!row) throw storageError("ASSET_NOT_FOUND", "الصورة غير موجودة.", 404);
  if (row.status === "ready") return signedAsset(row);
  if (!row.uploadExpiresAt || new Date(row.uploadExpiresAt).getTime() <= Date.now()) {
    await Promise.allSettled([
      deletePrivateObject(row.storageKey),
      query("DELETE FROM storage_assets WHERE id=$1 AND tenant_id=$2 AND status='uploading'", [assetId, session.tenantId])
    ]);
    throw storageError("UPLOAD_RESERVATION_EXPIRED", "انتهت مهلة الرفع. ابدأ رفع الصورة مرة أخرى.", 410);
  }
  try {
    const inspected = await inspectPrivateObject(row.storageKey);
    if (inspected.size !== Number(row.sizeBytes)) throw storageError("UPLOAD_SIZE_MISMATCH", "حجم الصورة المرفوعة لا يطابق الحجم المتوقع.", 409);
    if (inspected.contentType !== row.mimeType) throw storageError("UPLOAD_MIME_MISMATCH", "نوع الصورة المرفوعة لا يطابق النوع المتوقع.", 409);
    const prefix = await readPrivateObjectPrefix(row.storageKey, 32);
    if (!IMAGE_RULES[row.mimeType]?.valid(prefix)) throw storageError("UPLOAD_MIME_MISMATCH", "محتوى الصورة لا يطابق صيغتها.", 409);
    const updated = await query(
      `UPDATE storage_assets SET status='ready',upload_expires_at=NULL,object_etag=$3,updated_at=now() WHERE id=$1 AND tenant_id=$2 AND status='uploading'
       RETURNING id,name,original_name AS "originalName",mime_type AS "mimeType",size_bytes AS "sizeBytes",storage_key AS "storageKey",status,created_at AS "createdAt"`,
      [assetId, session.tenantId, inspected.etag]
    );
    await query(
      `INSERT INTO storage_activity(tenant_id,user_id,action,resource_type,resource_id,metadata)
       VALUES($1,$2,'UPLOAD_IMAGE','asset',$3,$4::jsonb)`,
      [session.tenantId, session.userId, assetId, JSON.stringify({ name: row.name, size: inspected.size })]
    );
    return signedAsset(updated.rows[0] || row);
  } catch (error) {
    await Promise.allSettled([
      deletePrivateObject(row.storageKey),
      query("DELETE FROM storage_assets WHERE id=$1 AND tenant_id=$2 AND status='uploading'", [assetId, session.tenantId])
    ]);
    throw error;
  }
}

export async function getStorageAssetDownload(session, assetId, { download = false } = {}) {
  if (!UUID.test(String(assetId || ""))) throw storageError("ASSET_NOT_FOUND", "الصورة غير موجودة.", 404);
  const result = await query(
    `SELECT original_name AS "originalName",storage_key AS "storageKey" FROM storage_assets
      WHERE id=$1 AND tenant_id=$2 AND status='ready' AND deleted_at IS NULL LIMIT 1`,
    [assetId, session.tenantId]
  );
  const row = result.rows[0];
  if (!row) throw storageError("ASSET_NOT_FOUND", "الصورة غير موجودة.", 404);
  return createPrivateDownload(row.storageKey, { filename: row.originalName, disposition: download ? "attachment" : "inline" });
}

export async function deleteStorageItem(session, kind, id, { force = false } = {}) {
  const tables = { folder: "storage_folders", document: "storage_documents", asset: "storage_assets" };
  const table = tables[kind];
  if (!table || !UUID.test(String(id || ""))) throw storageError("ITEM_NOT_FOUND", "العنصر غير موجود.", 404);
  const result = await transaction(async (client) => {
    const extra = kind === "folder" ? `,is_system AS "isSystem"` : kind === "asset" ? `,status,storage_key AS "storageKey"` : "";
    const found = await client.query(`SELECT id${extra} FROM ${table} WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, session.tenantId]);
    if (!found.rows[0]) throw storageError("ITEM_NOT_FOUND", "العنصر غير موجود.", 404);
    if (kind === "folder" && found.rows[0].isSystem) throw storageError("SYSTEM_FOLDER_IMMUTABLE", "مجلد الصور نظامي ولا يمكن حذفه.", 409);
    if (kind === "asset" && !force) {
      const references = await client.query(
        "SELECT count(*)::int AS count FROM tenant_salla_template_images WHERE tenant_id=$1 AND storage_asset_id=$2",
        [session.tenantId, id]
      );
      const usageCount = Number(references.rows[0]?.count || 0);
      if (usageCount) {
        throw Object.assign(storageError("ASSET_IN_USE", `هذه الصورة مستخدمة في ${usageCount} قالب. حذفها قد يؤدي إلى اختفائها من القوالب.`, 409), { usageCount });
      }
    }
    if (kind === "folder") {
      const tree = await client.query(
        `WITH RECURSIVE folder_tree AS (
           SELECT id FROM storage_folders WHERE id=$1 AND tenant_id=$2
           UNION ALL SELECT f.id FROM storage_folders f JOIN folder_tree p ON f.parent_id=p.id WHERE f.tenant_id=$2 AND f.deleted_at IS NULL
         ) SELECT id FROM folder_tree`, [id, session.tenantId]
      );
      const ids = tree.rows.map((row) => row.id);
      await client.query("UPDATE storage_documents SET deleted_at=now(),updated_at=now() WHERE tenant_id=$1 AND folder_id=ANY($2::uuid[]) AND deleted_at IS NULL", [session.tenantId, ids]);
      await client.query("UPDATE storage_assets SET deleted_at=now(),updated_at=now() WHERE tenant_id=$1 AND folder_id=ANY($2::uuid[]) AND deleted_at IS NULL", [session.tenantId, ids]);
      await client.query("UPDATE storage_folders SET deleted_at=now(),updated_at=now() WHERE tenant_id=$1 AND id=ANY($2::uuid[])", [session.tenantId, ids]);
    } else if (kind === "asset" && found.rows[0].status === "uploading") {
      await client.query("DELETE FROM storage_assets WHERE id=$1 AND tenant_id=$2", [id, session.tenantId]);
    } else {
      await client.query(`UPDATE ${table} SET deleted_at=now(),updated_at=now() WHERE id=$1 AND tenant_id=$2`, [id, session.tenantId]);
    }
    await client.query(
      `INSERT INTO storage_activity(tenant_id,user_id,action,resource_type,resource_id) VALUES($1,$2,'DELETE_ITEM',$3,$4)`,
      [session.tenantId, session.userId, kind, id]
    );
    return { id, kind, deleted: true, objectKey: kind === "asset" && found.rows[0].status === "uploading" ? found.rows[0].storageKey : "" };
  });
  if (result.objectKey) await deletePrivateObject(result.objectKey).catch(() => {});
  delete result.objectKey;
  return result;
}

export async function renameStorageItem(session, kind, id, nameValue) {
  const tables = { folder: ["storage_folders", "name"], document: ["storage_documents", "title"], asset: ["storage_assets", "name"] };
  const config = tables[kind];
  const name = cleanText(nameValue, kind === "folder" ? 120 : 180);
  if (!config || !UUID.test(String(id || ""))) throw storageError("ITEM_NOT_FOUND", "العنصر غير موجود.", 404);
  if (!name) throw storageError("INVALID_ITEM_NAME", "أدخل اسمًا صالحًا.");
  const [table, column] = config;
  try {
    return await transaction(async (client) => {
      const existing = await client.query(`SELECT id${kind === "folder" ? ',is_system AS "isSystem"' : ""} FROM ${table} WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, session.tenantId]);
      if (!existing.rows[0]) throw storageError("ITEM_NOT_FOUND", "العنصر غير موجود.", 404);
      if (existing.rows[0].isSystem) throw storageError("SYSTEM_FOLDER_IMMUTABLE", "لا يمكن تغيير اسم مجلد الصور النظامي.", 409);
      await client.query(`UPDATE ${table} SET ${column}=$3,updated_at=now() WHERE id=$1 AND tenant_id=$2`, [id, session.tenantId, name]);
      await client.query("INSERT INTO storage_activity(tenant_id,user_id,action,resource_type,resource_id,metadata) VALUES($1,$2,'RENAME_ITEM',$3,$4,$5::jsonb)", [session.tenantId, session.userId, kind, id, JSON.stringify({ name })]);
      return { id, kind, name };
    });
  } catch (error) {
    if (error?.code === "23505") throw storageError("ITEM_NAME_EXISTS", "يوجد عنصر بهذا الاسم في الموقع نفسه.", 409);
    throw error;
  }
}

export async function moveStorageItem(session, kind, id, folderIdValue) {
  const tables = { folder: "storage_folders", document: "storage_documents", asset: "storage_assets" };
  const table = tables[kind];
  const folderId = folderIdValue || null;
  if (!table || !UUID.test(String(id || ""))) throw storageError("ITEM_NOT_FOUND", "العنصر غير موجود.", 404);
  return transaction(async (client) => {
    if (folderId) await requireFolder(session, folderId, client);
    const current = await client.query(`SELECT id${kind === "folder" ? ',is_system AS "isSystem"' : ""} FROM ${table} WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, session.tenantId]);
    if (!current.rows[0]) throw storageError("ITEM_NOT_FOUND", "العنصر غير موجود.", 404);
    if (current.rows[0].isSystem) throw storageError("SYSTEM_FOLDER_IMMUTABLE", "لا يمكن نقل مجلد الصور النظامي.", 409);
    if (kind === "folder" && folderId) {
      const cycle = await client.query(
        `WITH RECURSIVE descendants AS (SELECT id FROM storage_folders WHERE id=$1 AND tenant_id=$2 UNION ALL SELECT f.id FROM storage_folders f JOIN descendants d ON f.parent_id=d.id WHERE f.tenant_id=$2)
         SELECT 1 FROM descendants WHERE id=$3 LIMIT 1`, [id, session.tenantId, folderId]
      );
      if (cycle.rows[0]) throw storageError("FOLDER_CYCLE", "لا يمكن نقل المجلد داخل نفسه أو أحد فروعه.", 409);
    }
    const column = kind === "folder" ? "parent_id" : "folder_id";
    await client.query(`UPDATE ${table} SET ${column}=$3,updated_at=now() WHERE id=$1 AND tenant_id=$2`, [id, session.tenantId, folderId]);
    await client.query("INSERT INTO storage_activity(tenant_id,user_id,action,resource_type,resource_id,metadata) VALUES($1,$2,'MOVE_ITEM',$3,$4,$5::jsonb)", [session.tenantId, session.userId, kind, id, JSON.stringify({ folderId })]);
    return { id, kind, folderId };
  });
}

export async function getStorageTrash(session) {
  const [folders, documents, assets] = await Promise.all([
    query("SELECT id,name,'folder' AS kind,0::bigint AS \"sizeBytes\",deleted_at AS \"deletedAt\" FROM storage_folders WHERE tenant_id=$1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100", [session.tenantId]),
    query("SELECT id,title AS name,'document' AS kind,size_bytes AS \"sizeBytes\",deleted_at AS \"deletedAt\" FROM storage_documents WHERE tenant_id=$1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100", [session.tenantId]),
    query("SELECT id,name,'asset' AS kind,size_bytes AS \"sizeBytes\",deleted_at AS \"deletedAt\" FROM storage_assets WHERE tenant_id=$1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100", [session.tenantId])
  ]);
  return [...folders.rows, ...documents.rows, ...assets.rows].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt)).slice(0, 150);
}

export async function restoreStorageItem(session, kind, id) {
  const tables = { folder: "storage_folders", document: "storage_documents", asset: "storage_assets" };
  const table = tables[kind];
  if (!table || !UUID.test(String(id || ""))) throw storageError("ITEM_NOT_FOUND", "العنصر غير موجود.", 404);
  return transaction(async (client) => {
    const current = await client.query(`SELECT id FROM ${table} WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NOT NULL FOR UPDATE`, [id, session.tenantId]);
    if (!current.rows[0]) throw storageError("ITEM_NOT_FOUND", "العنصر غير موجود في السلة.", 404);
    if (kind === "folder") {
      const tree = await client.query("WITH RECURSIVE folder_tree AS (SELECT id FROM storage_folders WHERE id=$1 AND tenant_id=$2 UNION ALL SELECT f.id FROM storage_folders f JOIN folder_tree p ON f.parent_id=p.id WHERE f.tenant_id=$2) SELECT id FROM folder_tree", [id, session.tenantId]);
      const ids = tree.rows.map((row) => row.id);
      await client.query("UPDATE storage_folders SET deleted_at=NULL,updated_at=now() WHERE tenant_id=$1 AND id=ANY($2::uuid[])", [session.tenantId, ids]);
      await client.query("UPDATE storage_documents SET deleted_at=NULL,updated_at=now() WHERE tenant_id=$1 AND folder_id=ANY($2::uuid[])", [session.tenantId, ids]);
      await client.query("UPDATE storage_assets SET deleted_at=NULL,updated_at=now() WHERE tenant_id=$1 AND folder_id=ANY($2::uuid[])", [session.tenantId, ids]);
    } else await client.query(`UPDATE ${table} SET deleted_at=NULL,updated_at=now() WHERE id=$1 AND tenant_id=$2`, [id, session.tenantId]);
    await client.query("INSERT INTO storage_activity(tenant_id,user_id,action,resource_type,resource_id) VALUES($1,$2,'RESTORE_ITEM',$3,$4)", [session.tenantId, session.userId, kind, id]);
    return { id, kind, restored: true };
  });
}

export async function permanentlyDeleteStorageItem(session, kind, id) {
  const tables = { folder: "storage_folders", document: "storage_documents", asset: "storage_assets" };
  const table = tables[kind];
  if (!table || !UUID.test(String(id || ""))) throw storageError("ITEM_NOT_FOUND", "العنصر غير موجود.", 404);
  let objectKeys = [];
  let folderIds = [];
  let folderTree = [];
  if (kind === "folder") {
    const tree = await query("WITH RECURSIVE folder_tree AS (SELECT id,0 AS depth FROM storage_folders WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NOT NULL UNION ALL SELECT f.id,p.depth+1 FROM storage_folders f JOIN folder_tree p ON f.parent_id=p.id WHERE f.tenant_id=$2) SELECT id,depth FROM folder_tree ORDER BY depth DESC", [id, session.tenantId]);
    folderTree = tree.rows;
    folderIds = folderTree.map((row) => row.id);
    if (!folderIds.length) throw storageError("ITEM_NOT_FOUND", "العنصر غير موجود في السلة.", 404);
    const assets = await query("SELECT storage_key AS \"storageKey\" FROM storage_assets WHERE tenant_id=$1 AND folder_id=ANY($2::uuid[]) AND deleted_at IS NOT NULL", [session.tenantId, folderIds]);
    objectKeys = assets.rows.map((row) => row.storageKey);
  } else if (kind === "asset") {
    const asset = await query("SELECT storage_key AS \"storageKey\" FROM storage_assets WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NOT NULL", [id, session.tenantId]);
    if (!asset.rows[0]) throw storageError("ITEM_NOT_FOUND", "العنصر غير موجود في السلة.", 404);
    objectKeys = [asset.rows[0].storageKey];
  }
  if (objectKeys.length) await deletePrivateObjectsAndVerify(objectKeys);
  await transaction(async (client) => {
    if (kind === "folder") {
      await client.query("DELETE FROM storage_assets WHERE tenant_id=$1 AND folder_id=ANY($2::uuid[])", [session.tenantId, folderIds]);
      await client.query("DELETE FROM storage_documents WHERE tenant_id=$1 AND folder_id=ANY($2::uuid[])", [session.tenantId, folderIds]);
      // PostgreSQL does not guarantee row deletion order for DELETE ... ANY().
      // Delete deepest children first to satisfy the RESTRICT parent FK.
      for (const folder of folderTree) {
        await client.query("DELETE FROM storage_folders WHERE tenant_id=$1 AND id=$2", [session.tenantId, folder.id]);
      }
    } else await client.query(`DELETE FROM ${table} WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NOT NULL`, [id, session.tenantId]);
  });
  return { id, kind, permanentlyDeleted: true };
}
