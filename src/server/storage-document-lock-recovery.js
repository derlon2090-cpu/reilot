import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { hashPassword } from "./password.js";
import { safeErrorMessage } from "./security.js";
import { sendStorageDocumentLockResetCodeEmail } from "./email/resend.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function recoveryError(code, message, status) {
  return Object.assign(new Error(message), { code, status });
}

function recoveryPepper() {
  const pepper = process.env.EMAIL_OTP_PEPPER?.trim() || "";
  if (pepper.length < 24) throw recoveryError("DOCUMENT_LOCK_RECOVERY_UNAVAILABLE", "خدمة استعادة كلمة مرور الملف غير متاحة حاليًا.", 503);
  return pepper;
}

function recoveryCodeHash(code) {
  return crypto.createHmac("sha256", recoveryPepper()).update(String(code)).digest("hex");
}

function safeHashMatch(left, right) {
  const supplied = Buffer.from(String(left || ""), "hex");
  const expected = Buffer.from(String(right || ""), "hex");
  return supplied.length === expected.length && supplied.length > 0 && crypto.timingSafeEqual(supplied, expected);
}

function validPassword(value) {
  return typeof value === "string" && value.length >= 8 && Buffer.byteLength(value, "utf8") <= 1024;
}

function maskEmail(value) {
  const [local = "", domain = ""] = String(value || "").split("@");
  if (!local || !domain) return "بريدك المسجل";
  return `${local.slice(0, 2)}${"*".repeat(Math.max(2, Math.min(6, local.length - 2)))}@${domain}`;
}

async function lockedDocument(session, documentId) {
  if (!UUID.test(String(documentId || ""))) throw recoveryError("DOCUMENT_NOT_FOUND", "المستند غير موجود.", 404);
  const result = await query(
    `SELECT d.id,d.title FROM storage_documents d
       JOIN storage_document_locks l ON l.document_id=d.id AND l.tenant_id=d.tenant_id
      WHERE d.id=$1 AND d.tenant_id=$2 AND d.deleted_at IS NULL`,
    [documentId, session.tenantId]
  );
  if (!result.rows[0]) throw recoveryError("DOCUMENT_LOCK_NOT_FOUND", "هذا الملف غير محمي بكلمة مرور.", 404);
  return result.rows[0];
}

export async function requestStorageDocumentLockRecovery(session, documentId, { mailer = sendStorageDocumentLockResetCodeEmail } = {}) {
  const document = await lockedDocument(session, documentId);
  const email = String(session.email || "").trim().toLowerCase();
  if (!email) throw recoveryError("DOCUMENT_LOCK_RECOVERY_EMAIL_MISSING", "لا يوجد بريد إلكتروني مرتبط بالحساب.", 400);
  const recent = await query(
    `SELECT count(*)::int AS count FROM storage_document_lock_recovery_codes
      WHERE tenant_id=$1 AND requested_by=$2 AND document_id=$3 AND created_at>now()-interval '15 minutes'`,
    [session.tenantId, session.userId, documentId]
  );
  if (Number(recent.rows[0]?.count || 0) >= 5) throw recoveryError("DOCUMENT_LOCK_RECOVERY_RATE_LIMIT", "تم إرسال رموز كثيرة. حاول مجددًا بعد 15 دقيقة.", 429);

  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await query(
    "UPDATE storage_document_lock_recovery_codes SET used_at=now() WHERE tenant_id=$1 AND requested_by=$2 AND document_id=$3 AND used_at IS NULL",
    [session.tenantId, session.userId, documentId]
  );
  const inserted = await query(
    `INSERT INTO storage_document_lock_recovery_codes(document_id,tenant_id,requested_by,code_hash,expires_at)
     VALUES($1,$2,$3,$4,$5) RETURNING id`,
    [documentId, session.tenantId, session.userId, recoveryCodeHash(code), expiresAt]
  );
  try {
    const sent = await mailer({ to: email, code, documentTitle: document.title, expiresInMinutes: 10, locale: "ar" });
    await query(
      `INSERT INTO email_logs(tenant_id,user_id,email,to_email,type,provider,provider_message_id,status,subject,body,sent_at)
       VALUES($1,$2,$3,$3,'storage_document_lock_reset','resend',$4,'sent','storage_document_lock_reset','[redacted]',now())`,
      [session.tenantId, session.userId, email, sent?.id || null]
    ).catch(() => null);
  } catch (error) {
    await query("UPDATE storage_document_lock_recovery_codes SET used_at=now() WHERE id=$1", [inserted.rows[0]?.id]).catch(() => null);
    await query(
      `INSERT INTO email_logs(tenant_id,user_id,email,to_email,type,provider,status,subject,body,error_message)
       VALUES($1,$2,$3,$3,'storage_document_lock_reset','resend','failed','storage_document_lock_reset','[redacted]',$4)`,
      [session.tenantId, session.userId, email, safeErrorMessage(error)]
    ).catch(() => null);
    throw recoveryError("DOCUMENT_LOCK_RECOVERY_DELIVERY_FAILED", "تعذر إرسال رمز التحقق. حاول مرة أخرى.", 503);
  }
  return { maskedEmail: maskEmail(email), expiresAt };
}

export async function resetStorageDocumentLockPassword(session, documentId, { code, password } = {}) {
  if (!UUID.test(String(documentId || ""))) throw recoveryError("DOCUMENT_NOT_FOUND", "المستند غير موجود.", 404);
  if (!/^\d{6}$/.test(String(code || ""))) throw recoveryError("DOCUMENT_LOCK_RECOVERY_CODE_INVALID", "أدخل رمز التحقق المكوّن من 6 أرقام.", 400);
  if (!validPassword(password)) throw recoveryError("INVALID_DOCUMENT_PASSWORD", "استخدم كلمة مرور من 8 أحرف على الأقل.", 400);

  const outcome = await transaction(async (client) => {
    const result = await client.query(
      `SELECT recovery.id,recovery.code_hash AS "codeHash",recovery.expires_at AS "expiresAt",recovery.attempts
         FROM storage_document_lock_recovery_codes recovery
         JOIN storage_documents document ON document.id=recovery.document_id AND document.tenant_id=recovery.tenant_id
         JOIN storage_document_locks lock ON lock.document_id=document.id AND lock.tenant_id=document.tenant_id
        WHERE recovery.document_id=$1 AND recovery.tenant_id=$2 AND recovery.requested_by=$3 AND recovery.used_at IS NULL
        ORDER BY recovery.created_at DESC LIMIT 1 FOR UPDATE OF recovery`,
      [documentId, session.tenantId, session.userId]
    );
    const recovery = result.rows[0];
    if (!recovery || new Date(recovery.expiresAt) <= new Date() || Number(recovery.attempts) >= 5) {
      return { ok: false, code: "DOCUMENT_LOCK_RECOVERY_CODE_EXPIRED", message: "انتهت صلاحية رمز التحقق. اطلب رمزًا جديدًا." };
    }
    if (!safeHashMatch(recoveryCodeHash(code), recovery.codeHash)) {
      await client.query("UPDATE storage_document_lock_recovery_codes SET attempts=attempts+1 WHERE id=$1", [recovery.id]);
      return { ok: false, code: "DOCUMENT_LOCK_RECOVERY_CODE_INVALID", message: "رمز التحقق غير صحيح." };
    }
    const passwordHash = await hashPassword(password);
    await client.query(
      "UPDATE storage_document_locks SET password_hash=$1,updated_at=now() WHERE document_id=$2 AND tenant_id=$3",
      [passwordHash, documentId, session.tenantId]
    );
    await client.query(
      "UPDATE storage_document_lock_recovery_codes SET used_at=now() WHERE document_id=$1 AND tenant_id=$2 AND requested_by=$3 AND used_at IS NULL",
      [documentId, session.tenantId, session.userId]
    );
    await client.query("DELETE FROM storage_document_unlock_attempts WHERE document_id=$1 AND tenant_id=$2", [documentId, session.tenantId]);
    return { ok: true, locked: true };
  });
  if (!outcome.ok) throw recoveryError(outcome.code, outcome.message, 400);
  return { locked: true };
}
