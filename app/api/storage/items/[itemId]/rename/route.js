import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { renameStorageItem } from "../../../../../../src/server/storage-center.js";

export async function PATCH(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const { itemId } = await params;
    const input = await request.json();
    return Response.json({ ok: true, item: await renameStorageItem(auth.session, String(input.kind || ""), itemId, input.name) });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "RENAME_ITEM_FAILED", message: error?.message || "تعذر تغيير الاسم." }, { status: Number(error?.status || 500) });
  }
}
