import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { userReply } from "../../../../../../src/server/support-tickets.js";

export async function POST(request, context) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  const { ticketId } = await context.params;
  try {
    const item = await userReply(auth.session, ticketId, await request.json().catch(() => ({})));
    return Response.json({ ok: true, item });
  } catch (error) {
    return Response.json({ ok: false, message: error.status ? error.message : "تعذر إرسال الرد." }, { status: error.status || 500 });
  }
}
