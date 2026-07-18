import { requireSession } from "../../../src/server/session.js";
import { getSallaDashboard } from "../../../src/server/salla-app.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  return Response.json({ ok: true, ...(await getSallaDashboard(auth.session.tenantId)) });
}
