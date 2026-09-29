import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { generateEmailTemplateCode } from "../../../../../src/server/ai/email-template-code.js";

export const runtime = "nodejs";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) {
    return Response.json({ ok: false, code: "INVALID_ORIGIN", message: "طلب غير صالح." }, { status: 403 });
  }
  try {
    const input = await request.json().catch(() => ({}));
    const result = await generateEmailTemplateCode(auth.session, input, {
      idempotencyKey: request.headers.get("x-idempotency-key"),
      signal: request.signal
    });
    return Response.json(result, { status: 200 });
  } catch (error) {
    const status = Number(error?.status || 500);
    const safeProviderCodes = new Set([
      "AI_PROVIDER_DISABLED", "AI_PROVIDER_AUTH_ERROR", "AI_PROVIDER_BALANCE_ERROR",
      "AI_PROVIDER_RATE_LIMIT", "AI_PROVIDER_TIMEOUT", "AI_PROVIDER_ERROR",
      "AI_PROVIDER_USAGE_MISSING"
    ]);
    const safeMessage = status < 500 || safeProviderCodes.has(error?.code)
      ? String(error?.message || "تعذر إنشاء القالب.")
      : "تعذر إنشاء القالب حاليًا. حاول مرة أخرى بعد قليل.";
    const usage = error?.usage || null;
    const quotaExhausted = error?.code === "AI_QUOTA_EXHAUSTED";
    const charged = Number(error?.charged || 0);
    const quota = usage || charged ? {
      charged,
      remaining: usage?.remainingTokens === null || usage?.remainingTokens === undefined
        ? null
        : Number(usage.remainingTokens),
      nextRefillAt: usage?.nextRefillAt || null
    } : null;
    return Response.json({
      ok: false,
      code: error?.code || "AI_EMAIL_GENERATION_FAILED",
      message: safeMessage,
      ...(quotaExhausted ? {
        remaining: Number(usage?.remainingTokens || 0),
        nextRefillAt: usage?.nextRefillAt || null
      } : {}),
      ...(quota ? { quota } : {})
    }, { status });
  }
}
