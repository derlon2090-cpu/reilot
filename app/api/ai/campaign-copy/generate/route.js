import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { generateCampaignCopy } from "../../../../../src/server/ai/campaign-copy.js";

export const runtime = "nodejs";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, code: "INVALID_ORIGIN", message: "طلب غير صالح." }, { status: 403 });
  try {
    const result = await generateCampaignCopy(auth.session, await request.json().catch(() => ({})), { idempotencyKey: request.headers.get("x-idempotency-key"), signal: request.signal });
    return Response.json(result);
  } catch (error) {
    const status = Number(error?.status || 500);
    return Response.json({
      ok: false,
      code: error?.code || "AI_CAMPAIGN_GENERATION_FAILED",
      message: status < 500 ? String(error?.message || "تعذر إنشاء نص الحملة.") : "تعذر إنشاء نص الحملة حاليًا. حاول مرة أخرى بعد قليل.",
      ...(error?.usage ? { quota: { charged: 0, remaining: Number(error.usage.remainingTokens || 0), nextRefillAt: error.usage.nextRefillAt || null } } : {}),
      ...(Number(error?.charged || 0) ? { quota: { charged: Number(error.charged), remaining: null, nextRefillAt: null } } : {})
    }, { status });
  }
}
