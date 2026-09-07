import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { deleteStorageItem, renameStorageItem, toggleStorageFolderPin } from "../../../../../src/server/storage-center.js";

export async function PATCH(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const { folderId } = await params;
    const body = await request.json().catch(() => ({}));
    if (typeof body.pinned === "boolean") return Response.json({ ok: true, item: await toggleStorageFolderPin(auth.session, folderId, body.pinned) });
    return Response.json({ ok: true, item: await renameStorageItem(auth.session, "folder", folderId, body.name) });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "UPDATE_FOLDER_FAILED", message: error?.message || "تعذر تحديث المجلد." }, { status: Number(error?.status || 500) });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const { folderId } = await params;
    return Response.json({ ok: true, item: await deleteStorageItem(auth.session, "folder", folderId) });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "DELETE_FOLDER_FAILED", message: error?.message || "تعذر حذف المجلد." }, { status: Number(error?.status || 500) });
  }
}
