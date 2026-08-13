import { requireSession } from "../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../src/server/campaign-contacts.js";
import { cleanupAIChatStorage, getAIChatStorage } from "../../../../src/server/ai/storage.js";

function fail(error) {
  return Response.json({
    ok: false,
    message: error.status ? error.message : "تعذر إدارة مساحة المحادثات حاليًا."
  }, { status: error.status || 500 });
}

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const keepConversationId = new URL(request.url).searchParams.get("keepConversationId");
    const storage = await getAIChatStorage(auth.session, { keepConversationId });
    return Response.json({ ok: true, storage });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) {
    return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  }
  try {
    const input = await request.json().catch(() => ({}));
    if (input.confirmation !== "DELETE_OLD_AI_CONVERSATIONS") {
      return Response.json({ ok: false, message: "يلزم تأكيد الحذف قبل إخلاء المساحة." }, { status: 400 });
    }
    const result = await cleanupAIChatStorage(auth.session, input);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return fail(error);
  }
}
