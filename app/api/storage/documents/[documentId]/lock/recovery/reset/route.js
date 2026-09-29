import { requireSession } from "../../../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../../../src/server/campaign-contacts.js";
import { ensureStorageCenterSchema } from "../../../../../../../../src/server/storage-schema.js";
import { resetStorageDocumentLockPassword } from "../../../../../../../../src/server/storage-document-lock-recovery.js";

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    await ensureStorageCenterSchema();
    const { documentId } = await params;
    const result = await resetStorageDocumentLockPassword(auth.session, documentId, await request.json());
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "DOCUMENT_LOCK_RECOVERY_FAILED", message: error?.message || "تعذر إعادة تعيين كلمة مرور الملف." }, { status: Number(error?.status || 500) });
  }
}
