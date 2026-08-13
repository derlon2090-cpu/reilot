import { requireSession } from "../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../src/server/campaign-contacts.js";
import { getAIUsageSummary, getAIUserPreferences, updateAIUserPreferences } from "../../../../src/server/ai/usage.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const [preferences, usage] = await Promise.all([
      getAIUserPreferences(auth.session),
      getAIUsageSummary(auth.session)
    ]);
    return Response.json({ ok: true, preferences, usage });
  } catch {
    return Response.json({ ok: false, message: "تعذر تحميل إعدادات ذكاء Renvix." }, { status: 503 });
  }
}

export async function PATCH(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const preferences = await updateAIUserPreferences(auth.session, await request.json().catch(() => ({})));
    return Response.json({ ok: true, preferences });
  } catch {
    return Response.json({ ok: false, message: "تعذر حفظ إعدادات ذكاء Renvix." }, { status: 503 });
  }
}
