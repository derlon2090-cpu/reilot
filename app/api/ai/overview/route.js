import { requireSession } from "../../../../src/server/session.js";
import { getAIUsageSummary, getAIUserPreferences } from "../../../../src/server/ai/usage.js";
import { getAIChatStorageSummary } from "../../../../src/server/ai/storage.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    // Account intelligence is intentionally excluded from this interactive path.
    // It scans business tables and must never delay the balance card.
    const [usageResult, preferencesResult, chatStorageResult] = await Promise.allSettled([
      getAIUsageSummary(auth.session),
      getAIUserPreferences(auth.session),
      getAIChatStorageSummary(auth.session)
    ]);
    if (usageResult.status === "rejected") {
      const reason = usageResult.reason;
      if (reason?.code === "AI_ENTITLEMENT_INACTIVE") {
        return Response.json({ ok: false, code: reason.code, message: reason.message, entitlement: reason.entitlement || null }, { status: Number(reason.status || 403) });
      }
      return Response.json({ ok: false, code: "AI_USAGE_UNAVAILABLE", message: "تعذر تحميل رصيد الذكاء حاليًا. حاول مرة أخرى بعد قليل." }, { status: 503 });
    }
    const warnings = [];
    if (preferencesResult.status === "rejected") warnings.push("preferences");
    if (chatStorageResult.status === "rejected") warnings.push("chatStorage");
    return Response.json({
      ok: true,
      snapshot: null,
      usage: usageResult.value,
      preferences: preferencesResult.status === "fulfilled" ? preferencesResult.value : null,
      chatStorage: chatStorageResult.status === "fulfilled" ? chatStorageResult.value : null,
      ...(warnings.length ? { warnings } : {})
    });
  } catch {
    return Response.json({ ok: false, message: "تعذر تحليل الحساب حاليًا." }, { status: 503 });
  }
}
