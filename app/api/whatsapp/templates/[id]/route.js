import { requireSession } from "../../../../../src/server/session.js";
import {
  deleteMetaTemplate,
  updateMetaTemplateDraft
} from "../../../../../src/server/meta-template-service.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";

export async function PUT(request, context) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  const { id } = await context.params;
  try {
    const item = await updateMetaTemplateDraft({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      templateId: id,
      input: await request.json().catch(() => ({}))
    });
    if (!item) return Response.json({ ok: false, message: "القالب غير موجود." }, { status: 404 });
    return Response.json({ ok: true, item });
  } catch (error) {
    return Response.json({ ok: false, code: error.code || "META_TEMPLATE_ERROR", message: error.message }, {
      status: Number(error.status) || 500
    });
  }
}

export async function DELETE(request, context) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  const { id } = await context.params;
  try {
    const item = await deleteMetaTemplate({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      templateId: id
    });
    if (!item) return Response.json({ ok: false, message: "القالب غير موجود." }, { status: 404 });
    return Response.json({ ok: true, item, message: "تم حذف القالب وتسجيل العملية في السجل الأمني." });
  } catch (error) {
    return Response.json({ ok: false, code: error.code || "META_TEMPLATE_DELETE_FAILED", message: error.message }, {
      status: Number(error.status) || 500
    });
  }
}
