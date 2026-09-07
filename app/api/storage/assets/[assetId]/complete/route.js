import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { completeStorageAssetUpload } from "../../../../../../src/server/storage-center.js";

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const { assetId } = await params;
    return Response.json({ ok: true, asset: await completeStorageAssetUpload(auth.session, assetId) });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "UPLOAD_COMPLETE_FAILED", message: error?.message || "تعذر إكمال رفع الصورة." }, { status: Number(error?.status || 500) });
  }
}
