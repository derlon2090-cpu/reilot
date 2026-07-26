import { requireSession } from "../../../src/server/session.js";
import { getBillingOverview } from "../../../src/server/billing-overview.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const overview = await getBillingOverview(auth.session.tenantId);
  return Response.json({ ok: true, ...overview });
}
