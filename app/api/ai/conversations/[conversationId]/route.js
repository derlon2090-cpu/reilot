import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { deleteAIConversation, getAIConversation, updateAIConversation } from "../../../../../src/server/ai/conversations.js";

function fail(error) {
  return Response.json({ ok: false, message: error.status ? error.message : "تعذر إكمال الطلب." }, { status: error.status || 500 });
}

export async function GET(request, { params }) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  const { conversationId } = await params;
  try {
    const item = await getAIConversation(auth.session, conversationId);
    if (!item) return Response.json({ ok: false, message: "المحادثة غير موجودة." }, { status: 404 });
    return Response.json({ ok: true, item });
  } catch (error) { return fail(error); }
}

export async function PATCH(request, { params }) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  const { conversationId } = await params;
  try {
    const item = await updateAIConversation(auth.session, conversationId, await request.json().catch(() => ({})));
    return Response.json({ ok: true, item });
  } catch (error) { return fail(error); }
}

export async function DELETE(request, { params }) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  const { conversationId } = await params;
  try {
    const item = await deleteAIConversation(auth.session, conversationId);
    return Response.json({ ok: true, item });
  } catch (error) { return fail(error); }
}
