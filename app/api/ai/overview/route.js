import { requireSession } from "../../../../src/server/session.js";
import { getAccountIntelligence } from "../../../../src/server/ai/account-intelligence.js";
import { getAIUsageSummary, getAIUserPreferences } from "../../../../src/server/ai/usage.js";
import { getAIChatStorage } from "../../../../src/server/ai/storage.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const [snapshotResult, usageResult, preferencesResult, chatStorageResult] = await Promise.allSettled([
      getAccountIntelligence(auth.session.tenantId),
      getAIUsageSummary(auth.session),
      getAIUserPreferences(auth.session),
      getAIChatStorage(auth.session)
    ]);
    if (usageResult.status === "rejected") {
      return Response.json({ ok: false, code: "AI_USAGE_UNAVAILABLE", message: "تعذر تحميل رصيد الذكاء حاليًا. حاول مرة أخرى بعد قليل." }, { status: 503 });
    }
    const warnings = [];
    if (snapshotResult.status === "rejected") warnings.push("snapshot");
    if (preferencesResult.status === "rejected") warnings.push("preferences");
    if (chatStorageResult.status === "rejected") warnings.push("chatStorage");
    return Response.json({
      ok: true,
      snapshot: snapshotResult.status === "fulfilled" ? snapshotResult.value : null,
      usage: usageResult.value,
      preferences: preferencesResult.status === "fulfilled" ? preferencesResult.value : null,
      chatStorage: chatStorageResult.status === "fulfilled" ? chatStorageResult.value : null,
      ...(warnings.length ? { warnings } : {})
    });
  } catch {
    return Response.json({ ok: false, message: "تعذر تحليل الحساب حاليًا." }, { status: 503 });
  }
}
