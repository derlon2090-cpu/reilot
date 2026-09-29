import { requireSession } from "../../../../../../src/server/session.js";
import { getStorageAssetDownload } from "../../../../../../src/server/storage-center.js";
import { folderPasswordsFromRequest, requireStorageItemFolderAccess } from "../../../../../../src/server/storage-folder-locks.js";
import { ensureStorageCenterSchema } from "../../../../../../src/server/storage-schema.js";

export async function GET(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const { assetId } = await params;
    await ensureStorageCenterSchema();
    await requireStorageItemFolderAccess(auth.session, "asset", assetId, folderPasswordsFromRequest(request));
    const url = new URL(request.url);
    return Response.json({ ok: true, download: await getStorageAssetDownload(auth.session, assetId, { download: url.searchParams.get("download") === "1" }) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "ASSET_NOT_FOUND", message: error?.message || "الصورة غير موجودة." }, { status: Number(error?.status || 500) });
  }
}
