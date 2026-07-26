import { requireSession } from "../../../../src/server/session.js";
import {
  createMetaTemplateDraft,
  listMetaTemplates
} from "../../../../src/server/meta-template-service.js";
import { sameOriginRequest } from "../../../../src/server/campaign-contacts.js";

function failure(error) {
  return Response.json(
    { ok: false, code: error.code || "META_TEMPLATE_ERROR", message: error.message || "تعذر تنفيذ العملية." },
    { status: Number(error.status) || 500 }
  );
}

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  return Response.json({ ok: true, ...(await listMetaTemplates(auth.session.tenantId)) }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" }
  });
}

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  try {
    const item = await createMetaTemplateDraft({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      input: await request.json().catch(() => ({}))
    });
    return Response.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
