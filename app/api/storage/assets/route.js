import { requireSession } from "../../../../src/server/session.js";
import { getStorageImageLibrary } from "../../../../src/server/storage-center.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    return Response.json({ ok: true, assets: await getStorageImageLibrary(auth.session, { search: url.searchParams.get("search") || "" }) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "STORAGE_ASSETS_FAILED", message: error?.message || "تعذر تحميل الصور المحفوظة." }, { status: Number(error?.status || 500) });
  }
}
