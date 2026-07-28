import { auditAdmin, requireAdminPermission } from "../../../../../../src/server/admin-auth.js";
import { sameOriginRequest } from "../../../../../../src/server/campaign-contacts.js";
import { getAdminTicket, updateAdminTicket } from "../../../../../../src/server/support-tickets.js";

export async function GET(request, context) {
  const auth = await requireAdminPermission(request, "support", "read");
  if (!auth.ok) return auth.response;
  const { ticketId } = await context.params;
  const item = await getAdminTicket(ticketId);
  if (!item) return Response.json({ ok: false, message: "التذكرة غير موجودة." }, { status: 404 });
  return Response.json({ ok: true, item });
}

export async function PATCH(request, context) {
  const input = await request.json().catch(() => ({}));
  const action = Object.hasOwn(input, "assignedAdminUserId")
    ? "assign"
    : ["RESOLVED", "CLOSED"].includes(input.status)
      ? "close"
      : "update";
  const auth = await requireAdminPermission(request, "support", action);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false }, { status: 403 });
  const { ticketId } = await context.params;
  try {
    const item = await updateAdminTicket(auth.admin, ticketId, input);
    await auditAdmin(request, { admin: auth.admin, action: "SUPPORT_TICKET_UPDATED", resource: ticketId });
    return Response.json({ ok: true, item });
  } catch (error) {
    return Response.json({ ok: false, message: error.status ? error.message : "تعذر تحديث التذكرة." }, { status: error.status || 500 });
  }
}
