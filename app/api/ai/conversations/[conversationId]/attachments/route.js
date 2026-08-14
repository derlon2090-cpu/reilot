import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { createAttachmentUpload } from "../../../../../../src/server/attachments/service.js";

function failure(error) {
  return Response.json({
    ok: false,
    code: error?.code || "R2_UNAVAILABLE",
    message: error?.message || "تعذر تجهيز رفع المرفق."
  }, { status: Number(error?.status || 503) });
}

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, code: "ATTACHMENT_FORBIDDEN", message: "طلب غير صالح." }, { status: 403 });
  try {
    const { conversationId } = await params;
    const input = await request.json().catch(() => ({}));
    const result = await createAttachmentUpload(auth.session, {
      conversationId,
      name: input.name,
      mimeType: input.mimeType,
      size: input.size,
      durationMs: input.durationMs
    });
    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
