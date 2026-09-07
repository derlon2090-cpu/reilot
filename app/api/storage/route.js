import { requireSession } from "../../../src/server/session.js";
import { getStorageCenter } from "../../../src/server/storage-center.js";

function failure(error) {
  return Response.json({ ok: false, code: error?.code || "STORAGE_UNAVAILABLE", message: error?.message || "تعذر تحميل مركز التخزين." }, { status: Number(error?.status || 500) });
}
export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const storage = await getStorageCenter(auth.session, {
      folderId: url.searchParams.get("folder") || null,
      search: url.searchParams.get("search") || "",
      sort: url.searchParams.get("sort") || "newest",
      type: url.searchParams.get("type") || "all",
      dateFrom: url.searchParams.get("dateFrom") || ""
    });
    return Response.json({ ok: true, storage }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
