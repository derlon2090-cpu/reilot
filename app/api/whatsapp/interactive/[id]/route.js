import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { updateInteractiveMessage } from "../../../../../src/server/meta-interactive-service.js";
import { requireSession } from "../../../../../src/server/session.js";

export async function PATCH(request, context) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (String(auth.session.role || "").toLowerCase() === "viewer") {
    return Response.json({ ok: false, message: "لا تملك صلاحية التعديل." }, { status: 403 });
  }
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  const { id } = await context.params;
  try {
    const item = await updateInteractiveMessage({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      messageId: id,
      input: await request.json().catch(() => ({}))
    });
    if (!item) return Response.json({ ok: false, message: "الرسالة التفاعلية غير موجودة." }, { status: 404 });
    return Response.json({ ok: true, item });
  } catch (error) {
    return Response.json({ ok: false, code: error.code || "INTERACTIVE_UPDATE_FAILED", message: error.message }, {
      status: Number(error.status) || 500
    });
  }
}
