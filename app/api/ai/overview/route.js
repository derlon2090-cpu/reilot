import { requireSession } from "../../../../src/server/session.js";
import { getAccountIntelligence } from "../../../../src/server/ai/account-intelligence.js";
import { getAIUsageSummary, getAIUserPreferences } from "../../../../src/server/ai/usage.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const [snapshot, usage, preferences] = await Promise.all([
      getAccountIntelligence(auth.session.tenantId),
      getAIUsageSummary(auth.session),
      getAIUserPreferences(auth.session)
    ]);
    return Response.json({ ok: true, snapshot, usage, preferences });
  } catch {
    return Response.json({ ok: false, message: "تعذر تحليل الحساب حاليًا." }, { status: 503 });
  }
}
