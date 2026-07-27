import { requireSession } from "../../../../../src/server/session.js";
import { listSallaAutomationTemplates } from "../../../../../src/server/salla-templates.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const payload = await listSallaAutomationTemplates({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId
    });
    return Response.json({ ok: true, ...payload }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  } catch (error) {
    return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status || 500 });
  }
}
