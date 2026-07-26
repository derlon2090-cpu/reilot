import { getCurrentMessageUsage } from "../../../../src/lib/billing/message-quota.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const usage = await getCurrentMessageUsage(auth.session.tenantId);
  const channels = {
    whatsapp: usage.channels?.whatsapp,
    email: usage.channels?.email
  };
  const byChannel = {
    whatsapp: usage.byChannel?.whatsapp || 0,
    email: usage.byChannel?.email || 0
  };
  return Response.json({ ok: true, ...usage, channels, byChannel });
}
