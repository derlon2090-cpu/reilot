import { getPublicStorageFolder } from "../../../../../src/server/storage-folder-shares.js";

function failure(error, fallback) {
  const status = Number(error?.status || 500);
  return Response.json(
    { ok: false, code: status >= 500 ? "SHARE_FAILED" : error?.code || "SHARE_FAILED", message: status >= 500 ? fallback : error?.message || fallback },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(_request, { params }) {
  try { const { token } = await params; return Response.json({ ok: true, folder: await getPublicStorageFolder(token) }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } }); }
  catch (error) { return failure(error, "تعذر فتح المجلد المشترك."); }
}
