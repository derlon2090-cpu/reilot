import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { deleteStorageItem, getStorageDocument, updateStorageDocument } from "../../../../../src/server/storage-center.js";
import { requireStorageDocumentPassword } from "../../../../../src/server/storage-document-locks.js";
import { ensureStorageCenterSchema } from "../../../../../src/server/storage-schema.js";
import { folderPasswordsFromRequest, requireStorageFolderAccess, requireStorageItemFolderAccess } from "../../../../../src/server/storage-folder-locks.js";
import { storageDocumentPasswordFromRequest } from "../../../../../src/server/storage-password-headers.js";

export async function GET(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    await ensureStorageCenterSchema();
    const { documentId } = await params;
    await requireStorageItemFolderAccess(auth.session, "document", documentId, folderPasswordsFromRequest(request));
    const locked = await requireStorageDocumentPassword(auth.session, documentId, storageDocumentPasswordFromRequest(request));
    return Response.json({ ok: true, document: { ...await getStorageDocument(auth.session, documentId), locked } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "DOCUMENT_NOT_FOUND", folderId: error?.folderId || null, message: error?.message || "المستند غير موجود." }, { status: Number(error?.status || 500) });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    await ensureStorageCenterSchema();
    const { documentId } = await params;
    await requireStorageItemFolderAccess(auth.session, "document", documentId, folderPasswordsFromRequest(request));
    await requireStorageDocumentPassword(auth.session, documentId, storageDocumentPasswordFromRequest(request));
    return Response.json({ ok: true, item: await deleteStorageItem(auth.session, "document", documentId) });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "DELETE_DOCUMENT_FAILED", folderId: error?.folderId || null, message: error?.message || "تعذر حذف المستند." }, { status: Number(error?.status || 500) });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    await ensureStorageCenterSchema();
    const { documentId } = await params;
    await requireStorageItemFolderAccess(auth.session, "document", documentId, folderPasswordsFromRequest(request));
    await requireStorageDocumentPassword(auth.session, documentId, storageDocumentPasswordFromRequest(request));
    const input = await request.json();
    if (input.folderId) await requireStorageFolderAccess(auth.session, input.folderId, folderPasswordsFromRequest(request));
    return Response.json({ ok: true, document: await updateStorageDocument(auth.session, documentId, input) });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "UPDATE_DOCUMENT_FAILED", folderId: error?.folderId || null, message: error?.message || "تعذر تحديث المستند." }, { status: Number(error?.status || 500) });
  }
}
