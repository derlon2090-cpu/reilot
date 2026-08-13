import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { processAIAttachment } from "../../../../../../src/server/ai/media-processing.js";

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, code: "ATTACHMENT_FORBIDDEN", message: "طلب غير صالح." }, { status: 403 });
  try {
    const { attachmentId } = await params;
    const force = new URL(request.url).searchParams.get("force") === "1";
    return Response.json({ ok: true, attachment: await processAIAttachment(auth.session, attachmentId, { force }) });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "ATTACHMENT_PROCESSING_FAILED", message: error?.message || "تعذر تحليل المرفق." }, { status: Number(error?.status || 500) });
  }
}
