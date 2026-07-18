import { requireSession } from "../../../../../src/server/session.js";
import { getSallaDashboard } from "../../../../../src/server/salla-app.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const data = await getSallaDashboard(auth.session.tenantId);
  return Response.json({ ok: true, configured: data.configured, connected: data.connection?.status === "connected", ...data.connection });
}
