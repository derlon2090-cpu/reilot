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
    const safeMessage = status < 500
      ? String(error?.message || "تعذر إنشاء القالب.")
      : "تعذر إنشاء القالب حاليًا. حاول مرة أخرى بعد قليل.";
    const usage = error?.usage || null;
    const quotaExhausted = error?.code === "AI_QUOTA_EXHAUSTED";
    return Response.json({
      ok: false,
      code: error?.code || "AI_EMAIL_GENERATION_FAILED",
      message: safeMessage,
      ...(quotaExhausted ? {
        remaining: Number(usage?.remainingTokens || 0),
        nextRefillAt: usage?.nextRefillAt || null
      } : {}),
      ...(usage ? { quota: { charged: 0, remaining: Number(usage.remainingTokens || 0), nextRefillAt: usage.nextRefillAt || null } } : {}),
      ...(Number(error?.charged || 0) ? { quota: { charged: Number(error.charged), remaining: null, nextRefillAt: null } } : {})
    }, { status });
  }
}
