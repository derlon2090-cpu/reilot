import { requireSession } from "../../../../../../src/server/session.js";
import { submitMetaTemplate } from "../../../../../../src/server/meta-template-service.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";

export async function POST(request, context) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  const { id } = await context.params;
  try {
    const item = await submitMetaTemplate({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      templateId: id
    });
    if (!item) return Response.json({ ok: false, message: "القالب غير موجود." }, { status: 404 });
    return Response.json({
      ok: true,
      item,
      message: "تم إرسال القالب إلى Meta. سيتم تحديث حالته تلقائيًا بعد انتهاء المراجعة."
    });
  } catch (error) {
    return Response.json({ ok: false, code: error.code || "META_TEMPLATE_SUBMIT_FAILED", message: error.message }, {
      status: Number(error.status) || 500
    });
  }
}
