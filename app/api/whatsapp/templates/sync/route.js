import { requireSession } from "../../../../../src/server/session.js";
import { syncMetaTemplates } from "../../../../../src/server/meta-template-service.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  try {
    const result = await syncMetaTemplates({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ ok: false, code: error.code || "META_TEMPLATE_SYNC_FAILED", message: error.message }, {
      status: Number(error.status) || 500
    });
  }
}
