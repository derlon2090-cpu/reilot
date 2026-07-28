import crypto from "node:crypto";
import { del, put } from "@vercel/blob";
import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import {
  assertUserTicketAttachmentAccess,
  saveUserTicketAttachment
} from "../../../../../../src/server/support-tickets.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const RULES = {
  "image/png": { ext: "png", valid: (b) => b[0] === 0x89 && b.subarray(1, 4).toString("ascii") === "PNG" },
  "image/jpeg": { ext: "jpg", valid: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": { ext: "webp", valid: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
  "application/pdf": { ext: "pdf", valid: (b) => b.subarray(0, 5).toString("ascii") === "%PDF-" },
  "text/plain": { ext: "txt", valid: (b) => !b.includes(0) }
};

function safeName(value) {
  return String(value || "attachment").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
}

export async function POST(request, context) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) {
    return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ ok: false, message: "تخزين المرفقات غير مهيأ حاليًا." }, { status: 503 });
  }
  const { ticketId } = await context.params;
  const formData = await request.formData().catch(() => null);
  const files = (formData?.getAll("files") || []).filter((file) => file && typeof file.arrayBuffer === "function");
  const messageId = String(formData?.get("messageId") || "") || null;
  if (!files.length) return Response.json({ ok: false, message: "اختر ملفًا واحدًا على الأقل." }, { status: 400 });
  if (files.length > 5) return Response.json({ ok: false, message: "الحد الأقصى خمسة مرفقات." }, { status: 400 });

  try {
    await assertUserTicketAttachmentAccess(auth.session, ticketId, files);
    const saved = [];
    for (const file of files) {
      if (!file.size || file.size > MAX_FILE_BYTES) {
        throw Object.assign(new Error("حجم كل ملف يجب ألا يتجاوز 10 ميجابايت."), { status: 400 });
      }
      const lowerName = String(file.name || "").toLowerCase();
      const normalizedType = file.type || (lowerName.endsWith(".txt") || lowerName.endsWith(".log") ? "text/plain" : "");
      const rule = RULES[normalizedType];
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!rule || !rule.valid(bytes)) {
        throw Object.assign(new Error("نوع الملف غير مدعوم. استخدم PNG أو JPG أو WebP أو PDF أو TXT."), { status: 400 });
      }
      const digest = crypto.createHash("sha256").update(bytes).digest("hex");
      const path = `support/${auth.session.tenantId}/${ticketId}/${crypto.randomUUID()}.${rule.ext}`;
      const blob = await put(path, bytes, {
        access: "public",
        addRandomSuffix: false,
        contentType: normalizedType
      });
      try {
        const row = await saveUserTicketAttachment(auth.session, ticketId, {
          messageId, url: blob.url, path, originalName: safeName(file.name),
          contentType: normalizedType, sizeBytes: file.size, sha256: digest
        });
        saved.push({ id: row.id, url: blob.url, originalName: safeName(file.name) });
      } catch (error) {
        await del(blob.url).catch(() => null);
        throw error;
      }
    }
    return Response.json({ ok: true, items: saved }, { status: 201 });
  } catch (error) {
    return Response.json(
      { ok: false, message: error.status ? error.message : "تعذر رفع المرفقات." },
      { status: error.status || 500 }
    );
  }
}
