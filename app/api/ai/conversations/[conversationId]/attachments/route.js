import crypto from "node:crypto";
import { del, put } from "@vercel/blob";
import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { getAIConversation } from "../../../../../../src/server/ai/conversations.js";
import { getTenantStorageLimitState } from "../../../../../../src/server/tenant-storage.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const RULES = {
  "image/png": { ext: "png", valid: (bytes) => bytes[0] === 0x89 && bytes.subarray(1, 4).toString("ascii") === "PNG" },
  "image/jpeg": { ext: "jpg", valid: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/webp": { ext: "webp", valid: (bytes) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" },
  "application/pdf": { ext: "pdf", valid: (bytes) => bytes.subarray(0, 5).toString("ascii") === "%PDF-" },
  "text/plain": { ext: "txt", valid: (bytes) => !bytes.includes(0) }
};

function safeName(value) {
  return String(value || "attachment").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
}

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ ok: false, message: "تخزين مرفقات المحادثة غير مهيأ حاليًا." }, { status: 503 });
  }
  const { conversationId } = await params;
  const conversation = await getAIConversation(auth.session, conversationId).catch(() => null);
  if (!conversation) return Response.json({ ok: false, message: "المحادثة غير موجودة." }, { status: 404 });
  const formData = await request.formData().catch(() => null);
  const files = (formData?.getAll("files") || []).filter((file) => file && typeof file.arrayBuffer === "function");
  if (!files.length) return Response.json({ ok: false, message: "اختر ملفًا واحدًا على الأقل." }, { status: 400 });
  if (files.length > 3) return Response.json({ ok: false, message: "الحد الأقصى ثلاثة مرفقات لكل رسالة." }, { status: 400 });
  const storage = await getTenantStorageLimitState(auth.session.tenantId);
  const requestedBytes = files.reduce((sum, file) => sum + Math.max(0, Number(file.size || 0)), 0);
  if (!storage.isUnlimited && requestedBytes > storage.remainingBytes) {
    return Response.json({
      ok: false, reason: "storage_limit_reached",
      message: "المرفقات المحددة أكبر من المساحة المتبقية في باقتك. أخلِ مساحة أو ارفع باقتك ثم أعد المحاولة.",
      storage
    }, { status: 403 });
  }

  const items = [];
  try {
    for (const file of files) {
      if (!file.size || file.size > MAX_FILE_BYTES) throw Object.assign(new Error("حجم كل ملف يجب ألا يتجاوز 10 ميجابايت."), { status: 400 });
      const lowerName = String(file.name || "").toLowerCase();
      const type = file.type || (/\.(txt|log)$/.test(lowerName) ? "text/plain" : "");
      const rule = RULES[type];
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!rule || !rule.valid(bytes)) throw Object.assign(new Error("نوع الملف غير مدعوم أو لا يطابق محتواه."), { status: 400 });
      const path = `ai/${auth.session.tenantId}/${auth.session.userId}/${conversationId}/${crypto.randomUUID()}.${rule.ext}`;
      await put(path, bytes, { access: "public", addRandomSuffix: false, contentType: type });
      items.push({ path, name: safeName(file.name), type, size: file.size });
    }
    return Response.json({ ok: true, items }, { status: 201 });
  } catch (error) {
    if (items.length) await del(items.map((item) => item.path)).catch(() => null);
    return Response.json({ ok: false, message: error.status ? error.message : "تعذر رفع مرفقات المحادثة." }, { status: error.status || 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  const { conversationId } = await params;
  const prefix = `ai/${auth.session.tenantId}/${auth.session.userId}/${conversationId}/`;
  const input = await request.json().catch(() => ({}));
  const paths = (Array.isArray(input.paths) ? input.paths : []).map(String).filter((path) => path.startsWith(prefix) && !path.includes(".."));
  if (!paths.length) return Response.json({ ok: true, deleted: 0 });
  if (process.env.BLOB_READ_WRITE_TOKEN) await del(paths).catch(() => null);
  return Response.json({ ok: true, deleted: paths.length });
}
