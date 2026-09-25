import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { getStorageDocumentShare, revokeStorageDocumentShare, saveStorageDocumentShare } from "../../../../../../src/server/storage-document-shares.js";

function shareUrl(request, token) {
  return new URL(`/shared/document/${encodeURIComponent(token)}`, request.url).toString();
}

function failure(error, fallback) {
  return Response.json({ ok: false, code: error?.code || "SHARE_FAILED", message: error?.message || fallback }, { status: Number(error?.status || 500) });
}

export async function GET(request, { params }) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  try {
    const { documentId } = await params;
    const share = await getStorageDocumentShare(auth.session, documentId);
    return Response.json({ ok: true, share: share.active ? { ...share, url: shareUrl(request, share.token), token: undefined } : share }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error, "تعذر تحميل إعدادات المشاركة."); }
}

export async function POST(request, { params }) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const { documentId } = await params;
    const share = await saveStorageDocumentShare(auth.session, documentId, await request.json());
    return Response.json({ ok: true, share: { ...share, url: shareUrl(request, share.token), token: undefined } });
  } catch (error) { return failure(error, "تعذر حفظ إعدادات المشاركة."); }
}

export async function DELETE(request, { params }) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try { const { documentId } = await params; return Response.json({ ok: true, share: await revokeStorageDocumentShare(auth.session, documentId) }); }
  catch (error) { return failure(error, "تعذر إيقاف رابط المشاركة."); }
}
