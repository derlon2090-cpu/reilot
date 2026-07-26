import { requireSession } from "../../../../../src/server/session.js";
import { getWhatsappBillingUsage } from "../../../../../src/server/billing-overview.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  return Response.json({ ok: true, ...(await getWhatsappBillingUsage(auth.session.tenantId)) });
}
