import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { deleteAttachment } from "../../../../../src/server/attachments/service.js";

export async function DELETE(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, code: "ATTACHMENT_FORBIDDEN", message: "طلب غير صالح." }, { status: 403 });
  try {
    const { attachmentId } = await params;
    return Response.json({ ok: true, attachment: await deleteAttachment(auth.session, attachmentId) });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "ATTACHMENT_NOT_FOUND", message: error?.message || "تعذر حذف المرفق." }, { status: Number(error?.status || 500) });
  }
}
