import { requireSession } from "../../../../src/server/session.js";
import { getStorageCenter } from "../../../../src/server/storage-center.js";
import { ensureStorageCenterSchema } from "../../../../src/server/storage-schema.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    await ensureStorageCenterSchema();
    const storage = await getStorageCenter(auth.session);
    return Response.json({ ok: true, usage: storage.usage, breakdown: storage.breakdown, limits: storage.limits }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "STORAGE_USAGE_FAILED", message: error?.message || "تعذر حساب مساحة التخزين." }, { status: Number(error?.status || 500) });
  }
}
