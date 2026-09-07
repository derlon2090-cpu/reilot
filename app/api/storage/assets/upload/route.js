import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { createStorageAssetUpload } from "../../../../../src/server/storage-center.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    return Response.json({ ok: true, ...(await createStorageAssetUpload(auth.session, await request.json())) }, { status: 201 });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "UPLOAD_START_FAILED", message: error?.message || "تعذر بدء رفع الصورة." }, { status: Number(error?.status || 500) });
  }
}
