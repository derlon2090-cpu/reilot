import { requireSession } from "../../../../../../src/server/session.js";
import { getStorageAssetDownload } from "../../../../../../src/server/storage-center.js";

export async function GET(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const { assetId } = await params;
    const url = new URL(request.url);
    return Response.json({ ok: true, download: await getStorageAssetDownload(auth.session, assetId, { download: url.searchParams.get("download") === "1" }) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "ASSET_NOT_FOUND", message: error?.message || "الصورة غير موجودة." }, { status: Number(error?.status || 500) });
  }
}
