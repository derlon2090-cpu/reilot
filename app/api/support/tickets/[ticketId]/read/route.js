import { requireSession } from "../../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { markUserRead } from "../../../../../../src/server/support-tickets.js";

export async function POST(request, context) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false }, { status: 403 });
  const { ticketId } = await context.params;
  const ok = await markUserRead(auth.session, ticketId);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
