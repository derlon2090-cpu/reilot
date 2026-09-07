import { requireSession } from "../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../src/server/campaign-contacts.js";
import { createStorageFolder } from "../../../../src/server/storage-center.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const folder = await createStorageFolder(auth.session, await request.json());
    return Response.json({ ok: true, folder }, { status: 201 });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "CREATE_FOLDER_FAILED", message: error?.message || "تعذر إنشاء المجلد." }, { status: Number(error?.status || 500) });
  }
}
