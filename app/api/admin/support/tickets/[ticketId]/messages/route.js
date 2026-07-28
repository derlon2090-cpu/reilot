import { auditAdmin, requireAdminPermission } from "../../../../../../../src/server/admin-auth.js";
import { sameOriginRequest } from "../../../../../../../src/server/campaign-contacts.js";
import { adminReply } from "../../../../../../../src/server/support-tickets.js";

export async function POST(request, context) {
  const auth = await requireAdminPermission(request, "support", "reply");
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false }, { status: 403 });
  const { ticketId } = await context.params;
  try {
    const input = await request.json().catch(() => ({}));
    const item = await adminReply(auth.admin, ticketId, input);
    await auditAdmin(request, { admin: auth.admin, action: input.internal ? "SUPPORT_NOTE_ADDED" : "SUPPORT_REPLY_SENT", resource: ticketId });
    return Response.json({ ok: true, item });
  } catch (error) {
    return Response.json({ ok: false, message: error.status ? error.message : "تعذر إرسال الرد." }, { status: error.status || 500 });
  }
}
