import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { saveSallaAutomationTemplate } from "../../../../../src/server/salla-templates.js";

export async function PUT(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  try {
    const input = await request.json().catch(() => ({}));
    const item = await saveSallaAutomationTemplate({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      templateKey: input.templateKey,
      input
    });
    return Response.json({ ok: true, item });
  } catch (error) {
    return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status || 500 });
  }
}
