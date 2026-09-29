import { query } from "./db.js";
import { hashPassword, verifyPassword } from "./password.js";
import { decodeStoragePasswordHeader } from "./storage-password-headers.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function folderError(code, message, status, folderId) {
  return Object.assign(new Error(message), { code, status, folderId });
}

export function folderPasswordsFromRequest(request) {
  const encoded = request.headers.get("x-storage-folder-passwords-b64");
  const raw = encoded
    ? decodeStoragePasswordHeader(encoded, 16_384)
    : request.headers.get("x-storage-folder-passwords") || "";
  if (!raw || Buffer.byteLength(raw, "utf8") > 16_384) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([id, value]) => UUID.test(id) && typeof value === "string" && Buffer.byteLength(value, "utf8") <= 1024).slice(0, 12));
  } catch { return {}; }
}

async function verifyFolderPassword(session, folderId, storedHash, password) {
  const attempts = await query(
    `SELECT count(*)::int AS count FROM storage_folder_unlock_attempts
      WHERE tenant_id=$1 AND user_id=$2 AND folder_id=$3 AND attempted_at>now()-interval '15 minutes'`,
    [session.tenantId, session.userId, folderId]
  );
  if (Number(attempts.rows[0]?.count || 0) >= 8) throw folderError("FOLDER_LOCK_RATE_LIMIT", "محاولات كثيرة. أعد المحاولة بعد 15 دقيقة.", 429, folderId);
  if (!await verifyPassword(String(password || ""), storedHash)) {
    if (password) await query("INSERT INTO storage_folder_unlock_attempts(tenant_id,user_id,folder_id) VALUES($1,$2,$3)", [session.tenantId, session.userId, folderId]);
    throw folderError("FOLDER_LOCKED", password ? "كلمة مرور الملف غير صحيحة." : "هذا الملف محمي بكلمة مرور.", 423, folderId);
  }
}

export async function requireStorageFolderAccess(session, folderId, passwords = {}) {
  if (!folderId) return [];
  if (!UUID.test(String(folderId))) throw folderError("FOLDER_NOT_FOUND", "الملف غير موجود.", 404, folderId);
  const result = await query(
    `WITH RECURSIVE path AS (
       SELECT id,parent_id,0 AS depth FROM storage_folders WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL
       UNION ALL SELECT parent.id,parent.parent_id,path.depth+1 FROM storage_folders parent JOIN path ON path.parent_id=parent.id
        WHERE parent.tenant_id=$2 AND parent.deleted_at IS NULL
     ) SELECT path.id,locks.password_hash AS "passwordHash" FROM path
       LEFT JOIN storage_folder_locks locks ON locks.folder_id=path.id AND locks.tenant_id=$2 ORDER BY path.depth DESC`,
    [folderId, session.tenantId]
  );
  if (!result.rows.length) throw folderError("FOLDER_NOT_FOUND", "الملف غير موجود.", 404, folderId);
  const unlocked = [];
  for (const row of result.rows) {
    if (!row.passwordHash) continue;
    await verifyFolderPassword(session, row.id, row.passwordHash, passwords[row.id]);
    unlocked.push(row.id);
  }
  return unlocked;
}

export async function requireStorageItemFolderAccess(session, kind, itemId, passwords = {}) {
  const table = kind === "document" ? "storage_documents" : kind === "asset" ? "storage_assets" : null;
  if (!table || !UUID.test(String(itemId || ""))) throw folderError("ITEM_NOT_FOUND", "العنصر غير موجود.", 404);
  const result = await query(`SELECT folder_id AS "folderId" FROM ${table} WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL LIMIT 1`, [itemId, session.tenantId]);
  if (!result.rows[0]) throw folderError("ITEM_NOT_FOUND", "العنصر غير موجود.", 404);
  return requireStorageFolderAccess(session, result.rows[0].folderId, passwords);
}

export async function requireStorageItemAccess(session, kind, itemId, passwords = {}) {
  return kind === "folder"
    ? requireStorageFolderAccess(session, itemId, passwords)
    : requireStorageItemFolderAccess(session, kind, itemId, passwords);
}

export async function setStorageFolderPassword(session, folderId, input = {}) {
  if (!UUID.test(String(folderId || ""))) throw folderError("FOLDER_NOT_FOUND", "الملف غير موجود.", 404, folderId);
  const result = await query(
    `SELECT folder.id,folder.is_system AS "isSystem",locks.password_hash AS "passwordHash"
       FROM storage_folders folder LEFT JOIN storage_folder_locks locks ON locks.folder_id=folder.id AND locks.tenant_id=folder.tenant_id
      WHERE folder.id=$1 AND folder.tenant_id=$2 AND folder.deleted_at IS NULL`,
    [folderId, session.tenantId]
  );
  const row = result.rows[0];
  if (!row) throw folderError("FOLDER_NOT_FOUND", "الملف غير موجود.", 404, folderId);
  if (row.isSystem) throw folderError("SYSTEM_FOLDER_IMMUTABLE", "لا يمكن قفل المجلد النظامي.", 409, folderId);
  if (row.passwordHash) await verifyFolderPassword(session, folderId, row.passwordHash, input.currentPassword);
  if (input.remove === true) {
    await query("DELETE FROM storage_folder_locks WHERE folder_id=$1 AND tenant_id=$2", [folderId, session.tenantId]);
    return { locked: false };
  }
  if (typeof input.password !== "string" || input.password.length < 8 || Buffer.byteLength(input.password, "utf8") > 1024) {
    throw folderError("INVALID_FOLDER_PASSWORD", "استخدم كلمة مرور من 8 أحرف على الأقل.", 400, folderId);
  }
  const hash = await hashPassword(input.password);
  await query(
    `INSERT INTO storage_folder_locks(folder_id,tenant_id,password_hash,created_by) VALUES($1,$2,$3,$4)
     ON CONFLICT(folder_id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=now()`,
    [folderId, session.tenantId, hash, session.userId]
  );
  await query("DELETE FROM storage_folder_unlock_attempts WHERE folder_id=$1 AND tenant_id=$2", [folderId, session.tenantId]);
  return { locked: true };
}
