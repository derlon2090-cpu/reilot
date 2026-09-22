import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { createStorageAssetUpload } from "../../../../../src/server/storage-center.js";
import { folderPasswordsFromRequest, requireStorageFolderAccess } from "../../../../../src/server/storage-folder-locks.js";
import { ensureStorageCenterSchema } from "../../../../../src/server/storage-schema.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    await ensureStorageCenterSchema();
    const input = await request.json();
    if (input.folderId) await requireStorageFolderAccess(auth.session, input.folderId, folderPasswordsFromRequest(request));
    return Response.json({ ok: true, ...(await createStorageAssetUpload(auth.session, input)) }, { status: 201 });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "UPLOAD_START_FAILED", message: error?.message || "تعذر بدء رفع الصورة." }, { status: Number(error?.status || 500) });
  }
}
