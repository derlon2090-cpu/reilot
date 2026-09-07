import { requireSession } from "../../../../src/server/session.js";
import { getStorageTrash } from "../../../../src/server/storage-center.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try { return Response.json({ ok: true, items: await getStorageTrash(auth.session) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return Response.json({ ok: false, code: error?.code || "TRASH_UNAVAILABLE", message: error?.message || "تعذر تحميل سلة المحذوفات." }, { status: Number(error?.status || 500) }); }
}
