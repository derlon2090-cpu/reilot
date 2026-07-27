import { requireSession } from "../../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../../src/server/campaign-contacts.js";
import {
  getSallaAutomationTemplate,
  previewSallaAutomationTemplate
} from "../../../../../../../src/server/salla-templates.js";

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  try {
    const { templateKey } = await params;
    const body = await request.json().catch(() => ({}));
    const payload = await getSallaAutomationTemplate({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      templateKey
    });
    return Response.json({ ok: true, preview: previewSallaAutomationTemplate(payload.item, body.variables) });
  } catch (error) {
    return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status || 500 });
  }
}
