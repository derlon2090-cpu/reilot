import { requireAdminPermission } from "../../../../../src/server/admin-auth.js";
import { adminListTickets } from "../../../../../src/server/support-tickets.js";

export async function GET(request) {
  const auth = await requireAdminPermission(request, "support", "read"); if (!auth.ok) return auth.response;
  const search = new URL(request.url).searchParams;
  try {
    const result = await adminListTickets(Object.fromEntries(search.entries()));
    return Response.json({ ok: true, ...result });
  } catch {
    return Response.json({ ok: false, message: "تعذر تحميل الرسائل والشكاوى." }, { status: 500 });
  }
}
