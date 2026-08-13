import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { createAIStreamResponse } from "../../../../../../src/server/ai/orchestrator.js";

export async function POST(request, { params }) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  const { conversationId } = await params;
  try {
    const input = await request.json().catch(() => ({}));
    return createAIStreamResponse(auth.session, { ...input, conversationId }, request.signal);
  } catch (error) {
    return Response.json({ ok: false, message: error.status ? error.message : "تعذر تشغيل ذكاء Renvix." }, { status: error.status || 500 });
  }
}
