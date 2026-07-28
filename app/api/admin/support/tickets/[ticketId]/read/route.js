import { auditAdmin, requireAdminPermission } from "../../../../../../../src/server/admin-auth.js";
import { sameOriginRequest } from "../../../../../../../src/server/campaign-contacts.js";
import { markAdminRead } from "../../../../../../../src/server/support-tickets.js";

export async function POST(request, context) {
  const auth = await requireAdminPermission(request, "support", "read");
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) {
    return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  }
  const { ticketId } = await context.params;
  const updated = await markAdminRead(ticketId);
  if (!updated) {
    return Response.json({ ok: false, message: "التذكرة غير موجودة." }, { status: 404 });
  }
  await auditAdmin(request, {
    admin: auth.admin,
    action: "SUPPORT_TICKET_READ",
    resource: ticketId
  });
  return Response.json({ ok: true });
}
