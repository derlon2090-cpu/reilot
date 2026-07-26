import { requireSession } from "../../../../../src/server/session.js";
import { getWhatsappBillingUsage } from "../../../../../src/server/billing-overview.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const usage = await getWhatsappBillingUsage(auth.session.tenantId);
  return Response.json({ ok: true, wallet: usage.wallet, items: usage.transactions });
}
