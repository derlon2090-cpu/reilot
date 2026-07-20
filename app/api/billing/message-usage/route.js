import { getCurrentMessageUsage } from "../../../../src/lib/billing/message-quota.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const usage = await getCurrentMessageUsage(auth.session.tenantId);
  return Response.json({ ok: true, ...usage });
}
