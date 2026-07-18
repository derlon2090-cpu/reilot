import { POST as checkConnection } from "../instances/[id]/check/route.js";
import { requireSession } from "../../../../src/server/session.js";
import { latestTenantChannel } from "../../../../src/server/whatsapp-repository.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const channel = await latestTenantChannel(auth.session.tenantId);
  if (!channel) {
    return Response.json({ ok: true, status: "disconnected", providerState: "no_channel", code: "WHATSAPP_CHANNEL_REQUIRED" });
  }
  return checkConnection(req, { params: Promise.resolve({ id: channel.id }) });
}
