import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { completeAttachmentUpload } from "../../../../../../src/server/attachments/service.js";

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, code: "ATTACHMENT_FORBIDDEN", message: "طلب غير صالح." }, { status: 403 });
  try {
    const { attachmentId } = await params;
    const attachment = await completeAttachmentUpload(auth.session, attachmentId);
    return Response.json({ ok: true, attachment });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "UPLOAD_VERIFICATION_FAILED", message: error?.message || "تعذر التحقق من المرفق." }, { status: Number(error?.status || 500) });
  }
}
