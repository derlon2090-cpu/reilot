import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import {
  getSallaAutomationTemplate,
  saveSallaAutomationTemplate
} from "../../../../../../src/server/salla-templates.js";

function fail(error) {
  return Response.json({ ok: false, code: error.code || "SALLA_TEMPLATE_ERROR", message: error.message }, { status: error.status || 500 });
}

export async function GET(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const { templateKey } = await params;
    return Response.json({
      ok: true,
      ...(await getSallaAutomationTemplate({
        tenantId: auth.session.tenantId,
        userId: auth.session.userId,
        templateKey
      }))
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  try {
    const { templateKey } = await params;
    const item = await saveSallaAutomationTemplate({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      templateKey,
      input: await request.json().catch(() => ({}))
    });
    return Response.json({ ok: true, item });
  } catch (error) {
    return fail(error);
  }
}
