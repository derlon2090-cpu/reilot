import { requireSession } from "../../../../../src/server/session.js";
import { getCurrentMessageUsage } from "../../../../../src/lib/billing/message-quota.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const usage = await getCurrentMessageUsage(auth.session.tenantId);
  return Response.json({
    ok: true,
    periodStart: usage.periodStart,
    periodEnd: usage.periodEnd,
    planName: usage.planName,
    ...usage.channels.email
  });
}
