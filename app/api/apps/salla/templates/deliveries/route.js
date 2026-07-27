import { requireSession } from "../../../../../../src/server/session.js";
import { listSallaTemplateDeliveries } from "../../../../../../src/server/salla-templates.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    return Response.json({
      ok: true,
      ...(await listSallaTemplateDeliveries({
        tenantId: auth.session.tenantId,
        userId: auth.session.userId,
        limit: url.searchParams.get("limit")
      }))
    });
  } catch (error) {
    return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status || 500 });
  }
}
