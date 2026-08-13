import { requireSession } from "../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../src/server/campaign-contacts.js";
import { createAIStreamResponse } from "../../../../src/server/ai/orchestrator.js";

export async function POST(request) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    return createAIStreamResponse(auth.session, await request.json().catch(() => ({})), request.signal);
  } catch (error) {
    return Response.json({ ok: false, code: error.code || "AI_REQUEST_FAILED", usage: error.usage || null, message: error.status ? error.message : "تعذر تشغيل ذكاء Renvix." }, { status: error.status || 500 });
  }
}
