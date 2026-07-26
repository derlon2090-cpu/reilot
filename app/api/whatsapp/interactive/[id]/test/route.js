import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { sendInteractiveMessage } from "../../../../../../src/server/meta-interactive-service.js";
import { requireSession } from "../../../../../../src/server/session.js";

export async function POST(request, context) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (String(auth.session.role || "").toLowerCase() === "viewer") {
    return Response.json({ ok: false, message: "لا تملك صلاحية الإرسال." }, { status: 403 });
  }
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await sendInteractiveMessage({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      messageId: id,
      recipient: body.recipient,
      idempotencyKey: body.idempotencyKey,
      isTest: true
    });
    if (!result) return Response.json({ ok: false, message: "الرسالة التفاعلية غير موجودة." }, { status: 404 });
    return Response.json({ ok: true, result, message: "قبلت Meta رسالة الاختبار." });
  } catch (error) {
    return Response.json({ ok: false, code: error.code || "INTERACTIVE_TEST_FAILED", message: error.message }, {
      status: Number(error.status) || 500
    });
  }
}
