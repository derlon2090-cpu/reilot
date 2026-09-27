import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { getPublicStorageDocument, updatePublicStorageDocument } from "../../../../../src/server/storage-document-shares.js";

function failure(error, fallback) {
  const status = Number(error?.status || 500);
  return Response.json(
    { ok: false, code: status >= 500 ? "SHARE_FAILED" : error?.code || "SHARE_FAILED", message: status >= 500 ? fallback : error?.message || fallback },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(_request, { params }) {
  try { const { token } = await params; return Response.json({ ok: true, document: await getPublicStorageDocument(token) }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } }); }
  catch (error) { return failure(error, "تعذر فتح الملف المشترك."); }
}

export async function PATCH(request, { params }) {
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try { const { token } = await params; return Response.json({ ok: true, document: await updatePublicStorageDocument(token, await request.json()) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error, "تعذر حفظ الملف المشترك."); }
}
