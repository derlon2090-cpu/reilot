import { requireSession } from "../../../../src/server/session.js";
import { getStorageCenter } from "../../../../src/server/storage-center.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const storage = await getStorageCenter(auth.session, { search: url.searchParams.get("q") || "", sort: url.searchParams.get("sort") || "newest" });
    return Response.json({ ok: true, folders: storage.folders, documents: storage.documents, assets: storage.assets }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "STORAGE_SEARCH_FAILED", message: error?.message || "تعذر البحث في مركز التخزين." }, { status: Number(error?.status || 500) });
  }
}
