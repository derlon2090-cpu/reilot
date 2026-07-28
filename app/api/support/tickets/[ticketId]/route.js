import { requireSession } from "../../../../../src/server/session.js";
import { getUserTicket } from "../../../../../src/server/support-tickets.js";

export async function GET(request, context) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  const { ticketId } = await context.params;
  try {
    const item = await getUserTicket(auth.session, ticketId);
    if (!item) return Response.json({ ok: false, message: "التذكرة غير موجودة." }, { status: 404 });
    return Response.json({ ok: true, item });
  } catch {
    return Response.json({ ok: false, message: "تعذر تحميل التذكرة." }, { status: 500 });
  }
}
