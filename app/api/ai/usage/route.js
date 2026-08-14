import { requireSession } from "../../../../src/server/session.js";
import { getAIUsageSummary } from "../../../../src/server/ai/usage.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const usage = await getAIUsageSummary(auth.session);
    return Response.json({ ok: true, usage }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error?.code === "AI_ENTITLEMENT_INACTIVE") {
      return Response.json({ ok: false, code: error.code, message: error.message }, {
        status: Number(error.status || 403),
        headers: { "Cache-Control": "no-store" }
      });
    }
    return Response.json({
      ok: false,
      code: "AI_USAGE_UNAVAILABLE",
      message: "تعذر تحميل رصيد الذكاء حاليًا. حاول مرة أخرى بعد قليل."
    }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3" } });
  }
}
