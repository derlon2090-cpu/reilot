import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { ensureStorageCenterSchema } from "../../../../../../src/server/storage-schema.js";
import { setStorageDocumentPassword } from "../../../../../../src/server/storage-document-locks.js";

export async function PUT(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    await ensureStorageCenterSchema();
    const { documentId } = await params;
    const result = await setStorageDocumentPassword(auth.session, documentId, await request.json());
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "DOCUMENT_LOCK_FAILED", message: error?.message || "تعذر تغيير قفل الملف." }, { status: Number(error?.status || 500) });
  }
}
