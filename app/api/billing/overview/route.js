import { requireSession } from "../../../../src/server/session.js";
import { getBillingOverview } from "../../../../src/server/billing-overview.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  return Response.json({ ok: true, ...(await getBillingOverview(auth.session.tenantId)) });
}
