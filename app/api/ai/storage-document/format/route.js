import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { formatStorageDocumentWithAI } from "../../../../../src/server/ai/storage-document-format.js";

export const runtime = "nodejs";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, code: "INVALID_ORIGIN", message: "طلب غير صالح." }, { status: 403 });
  try {
    const result = await formatStorageDocumentWithAI(auth.session, await request.json().catch(() => ({})), {
      idempotencyKey: request.headers.get("x-idempotency-key"),
      signal: request.signal
    });
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = Number(error?.status || 500);
    return Response.json({
      ok: false,
      code: error?.code || "AI_STORAGE_FORMAT_FAILED",
      message: status < 500 ? String(error?.message || "تعذر ترتيب النص.") : "تعذر ترتيب النص حاليًا. حاول مرة أخرى بعد قليل."
    }, { status });
  }
}
