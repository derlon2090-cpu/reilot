import { getDashboardOverview } from "../../../../src/server/dashboard-data.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const overview = await getDashboardOverview(auth.session.tenantId, auth.session.userId);
  return Response.json({ ok: true, ...overview });
}
