import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { closeUserTicket } from "../../../../../../src/server/support-tickets.js";

export async function POST(request, context) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  const { ticketId } = await context.params;
  try {
    return Response.json({ ok: true, item: await closeUserTicket(auth.session, ticketId) });
  } catch (error) {
    return Response.json({ ok: false, message: error.status ? error.message : "تعذر إغلاق التذكرة." }, { status: error.status || 500 });
  }
}
