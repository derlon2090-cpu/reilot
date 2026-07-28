import { requireSession } from "../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../src/server/campaign-contacts.js";
import { createTicket, listUserTickets } from "../../../../src/server/support-tickets.js";

function fail(error) {
  return Response.json({ ok: false, message: error.status ? error.message : "تعذر إكمال الطلب." }, { status: error.status || 500 });
}

export async function GET(request) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  const search = new URL(request.url).searchParams;
  try {
    const result = await listUserTickets(auth.session, {
      filter: search.get("filter"), page: search.get("page"), limit: search.get("limit")
    });
    return Response.json({ ok: true, ...result });
  } catch (error) { return fail(error); }
}

export async function POST(request) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const item = await createTicket(auth.session, await request.json().catch(() => ({})));
    return Response.json({ ok: true, item }, { status: 201 });
  } catch (error) { return fail(error); }
}
