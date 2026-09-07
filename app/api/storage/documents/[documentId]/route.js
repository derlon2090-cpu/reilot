import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { deleteStorageItem, getStorageDocument, updateStorageDocument } from "../../../../../src/server/storage-center.js";

export async function GET(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const { documentId } = await params;
    return Response.json({ ok: true, document: await getStorageDocument(auth.session, documentId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "DOCUMENT_NOT_FOUND", message: error?.message || "المستند غير موجود." }, { status: Number(error?.status || 500) });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const { documentId } = await params;
    return Response.json({ ok: true, item: await deleteStorageItem(auth.session, "document", documentId) });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "DELETE_DOCUMENT_FAILED", message: error?.message || "تعذر حذف المستند." }, { status: Number(error?.status || 500) });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const { documentId } = await params;
    return Response.json({ ok: true, document: await updateStorageDocument(auth.session, documentId, await request.json()) });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "UPDATE_DOCUMENT_FAILED", message: error?.message || "تعذر تحديث المستند." }, { status: Number(error?.status || 500) });
  }
}
