import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { permanentlyDeleteStorageItem } from "../../../../../../src/server/storage-center.js";

export async function DELETE(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try { const { itemId } = await params; const input = await request.json(); return Response.json({ ok: true, item: await permanentlyDeleteStorageItem(auth.session, input.kind, itemId) }); }
  catch (error) { return Response.json({ ok: false, code: error?.code || "PERMANENT_DELETE_FAILED", message: error?.message || "تعذر الحذف النهائي." }, { status: Number(error?.status || 500) }); }
}
