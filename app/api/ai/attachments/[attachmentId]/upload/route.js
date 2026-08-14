import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { uploadAttachmentBytes } from "../../../../../../src/server/attachments/service.js";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

async function readLimitedBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ATTACHMENT_BYTES) {
      await reader.cancel().catch(() => {});
      throw Object.assign(new Error("حجم الملف أكبر من الحد المسموح."), { code: "ATTACHMENT_TOO_LARGE", status: 413 });
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export async function PUT(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) {
    return Response.json({ ok: false, code: "ATTACHMENT_FORBIDDEN", message: "طلب غير صالح." }, { status: 403 });
  }
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_ATTACHMENT_BYTES) {
    return Response.json({ ok: false, code: "ATTACHMENT_TOO_LARGE", message: "حجم الملف أكبر من الحد المسموح." }, { status: 413 });
  }
  try {
    const { attachmentId } = await params;
    const bytes = await readLimitedBody(request);
    const attachment = await uploadAttachmentBytes(
      auth.session,
      attachmentId,
      bytes,
      request.headers.get("content-type") || "application/octet-stream"
    );
    return Response.json({ ok: true, attachment });
  } catch (error) {
    return Response.json({
      ok: false,
      code: error?.code || "R2_UNAVAILABLE",
      message: error?.message || "تعذر رفع المرفق إلى التخزين الخاص."
    }, { status: Number(error?.status || 500) });
  }
}
