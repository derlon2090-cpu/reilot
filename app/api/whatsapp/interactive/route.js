import { sameOriginRequest } from "../../../../src/server/campaign-contacts.js";
import {
  createInteractiveMessage,
  listInteractiveMessages
} from "../../../../src/server/meta-interactive-service.js";
import { requireSession } from "../../../../src/server/session.js";

function canMutate(role) {
  return !["viewer"].includes(String(role || "").toLowerCase());
}

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  return Response.json({ ok: true, items: await listInteractiveMessages(auth.session.tenantId) }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" }
  });
}

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!canMutate(auth.session.role)) return Response.json({ ok: false, message: "لا تملك صلاحية التعديل." }, { status: 403 });
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  try {
    const item = await createInteractiveMessage({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      input: await request.json().catch(() => ({}))
    });
    return Response.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    return Response.json({ ok: false, code: error.code || "INTERACTIVE_CREATE_FAILED", message: error.message }, {
      status: Number(error.status) || 500
    });
  }
}
