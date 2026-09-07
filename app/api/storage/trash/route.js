import { requireSession } from "../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../src/server/campaign-contacts.js";
import { emptyStorageTrash, getStorageTrash } from "../../../../src/server/storage-center.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try { return Response.json({ ok: true, items: await getStorageTrash(auth.session) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return Response.json({ ok: false, code: error?.code || "TRASH_UNAVAILABLE", message: error?.message || "تعذر تحميل سلة المحذوفات." }, { status: Number(error?.status || 500) }); }
}

export async function DELETE(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try { return Response.json({ ok: true, result: await emptyStorageTrash(auth.session) }); }
  catch (error) { return Response.json({ ok: false, code: error?.code || "TRASH_EMPTY_FAILED", message: error?.message || "تعذر إفراغ سلة المحذوفات." }, { status: Number(error?.status || 500) }); }
}
