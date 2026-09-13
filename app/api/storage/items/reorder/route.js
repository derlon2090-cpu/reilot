import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { reorderStorageItems } from "../../../../../src/server/storage-center.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    return Response.json({ ok: true, order: await reorderStorageItems(auth.session, await request.json()) });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "STORAGE_REORDER_FAILED", message: error?.message || "تعذر حفظ الترتيب." }, { status: Number(error?.status || 500) });
  }
}
