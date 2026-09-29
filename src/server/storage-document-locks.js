import { query } from "./db.js";
import { hashPassword, verifyPassword } from "./password.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function lockError(code, message, status) {
  return Object.assign(new Error(message), { code, status });
}

function validPassword(value) {
  return typeof value === "string" && value.length >= 8 && Buffer.byteLength(value, "utf8") <= 1024;
}

async function lockRow(session, documentId) {
  if (!UUID.test(String(documentId || ""))) throw lockError("DOCUMENT_NOT_FOUND", "المستند غير موجود.", 404);
  const result = await query(
    `SELECT d.id,l.password_hash AS "passwordHash" FROM storage_documents d
       LEFT JOIN storage_document_locks l ON l.document_id=d.id AND l.tenant_id=d.tenant_id
      WHERE d.id=$1 AND d.tenant_id=$2 AND d.deleted_at IS NULL`,
    [documentId, session.tenantId]
  );
  if (!result.rows[0]) throw lockError("DOCUMENT_NOT_FOUND", "المستند غير موجود.", 404);
  return result.rows[0];
}

export async function requireStorageDocumentPassword(session, documentId, password) {
  const row = await lockRow(session, documentId);
  if (!row.passwordHash) return false;
  const attempts = await query(
    `SELECT count(*)::int AS count FROM storage_document_unlock_attempts
      WHERE tenant_id=$1 AND user_id=$2 AND document_id=$3 AND attempted_at>now()-interval '15 minutes'`,
    [session.tenantId, session.userId, documentId]
  );
  if (Number(attempts.rows[0]?.count || 0) >= 8) throw lockError("DOCUMENT_LOCK_RATE_LIMIT", "محاولات كثيرة. أعد المحاولة بعد 15 دقيقة.", 429);
  if (!await verifyPassword(String(password || ""), row.passwordHash)) {
    if (password) await query(
      `INSERT INTO storage_document_unlock_attempts(tenant_id,user_id,document_id) VALUES($1,$2,$3)`,
      [session.tenantId, session.userId, documentId]
    );
    throw lockError("DOCUMENT_LOCKED", password ? "كلمة مرور الملف غير صحيحة." : "هذا الملف محمي بكلمة مرور.", 423);
  }
  return true;
}

export async function setStorageDocumentPassword(session, documentId, input = {}) {
  const row = await lockRow(session, documentId);
  if (row.passwordHash) await requireStorageDocumentPassword(session, documentId, input.currentPassword);
  if (input.remove === true) {
    if (!row.passwordHash) return { locked: false };
    await query("DELETE FROM storage_document_locks WHERE document_id=$1 AND tenant_id=$2", [documentId, session.tenantId]);
    return { locked: false };
  }
  if (!validPassword(input.password)) throw lockError("INVALID_DOCUMENT_PASSWORD", "استخدم كلمة مرور من 8 أحرف على الأقل.", 400);
  const passwordHash = await hashPassword(input.password);
  await query(
    `INSERT INTO storage_document_locks(document_id,tenant_id,password_hash,created_by)
     VALUES($1,$2,$3,$4) ON CONFLICT(document_id) DO UPDATE
     SET password_hash=excluded.password_hash,updated_at=now()`,
    [documentId, session.tenantId, passwordHash, session.userId]
  );
  await query("DELETE FROM storage_document_unlock_attempts WHERE document_id=$1 AND tenant_id=$2", [documentId, session.tenantId]);
  return { locked: true };
}
