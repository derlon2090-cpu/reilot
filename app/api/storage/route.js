import { requireSession } from "../../../src/server/session.js";
import { getStorageCenter } from "../../../src/server/storage-center.js";
import { ensureStorageCenterSchema } from "../../../src/server/storage-schema.js";

export const maxDuration = 60;

function failure(error) {
  return Response.json({ ok: false, code: error?.code || "STORAGE_UNAVAILABLE", message: error?.message || "تعذر تحميل مركز التخزين." }, { status: Number(error?.status || 500) });
}
export async function GET(request) {
  try {
    await ensureStorageCenterSchema();
  } catch (error) {
    console.error("storage schema readiness failed", { code: error?.code || "STORAGE_SCHEMA_UNAVAILABLE" });
    return Response.json({ ok: false, code: "STORAGE_SCHEMA_UNAVAILABLE", message: "تعذر تهيئة مركز التخزين." }, { status: 503 });
  }
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
