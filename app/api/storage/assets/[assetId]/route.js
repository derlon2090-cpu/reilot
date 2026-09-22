import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { deleteStorageItem } from "../../../../../src/server/storage-center.js";
import { folderPasswordsFromRequest, requireStorageItemFolderAccess } from "../../../../../src/server/storage-folder-locks.js";
import { ensureStorageCenterSchema } from "../../../../../src/server/storage-schema.js";

export async function DELETE(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const { assetId } = await params;
    await ensureStorageCenterSchema();
    await requireStorageItemFolderAccess(auth.session, "asset", assetId, folderPasswordsFromRequest(request));
    const force = new URL(request.url).searchParams.get("force") === "1";
    return Response.json({ ok: true, item: await deleteStorageItem(auth.session, "asset", assetId, { force }) });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "DELETE_ASSET_FAILED", message: error?.message || "تعذر حذف الصورة.", usageCount: Number(error?.usageCount || 0) }, { status: Number(error?.status || 500) });
  }
}
