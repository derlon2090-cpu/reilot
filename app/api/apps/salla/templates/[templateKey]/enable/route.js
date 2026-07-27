import { requireSession } from "../../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../../src/server/campaign-contacts.js";
import { setSallaAutomationTemplateEnabled } from "../../../../../../../src/server/salla-templates.js";

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  try {
    const { templateKey } = await params;
    const result = await setSallaAutomationTemplateEnabled({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      templateKey,
      enabled: true
    });
    return Response.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status || 500 });
  }
}
