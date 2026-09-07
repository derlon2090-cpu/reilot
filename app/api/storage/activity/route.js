import { requireSession } from "../../../../src/server/session.js";
import { getStorageCenter } from "../../../../src/server/storage-center.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const storage = await getStorageCenter(auth.session);
    return Response.json({ ok: true, activity: storage.activity }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "STORAGE_ACTIVITY_FAILED", message: error?.message || "تعذر تحميل النشاط." }, { status: Number(error?.status || 500) });
  }
}
