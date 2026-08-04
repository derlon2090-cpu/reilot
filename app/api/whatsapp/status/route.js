import { requireSession } from "../../../../src/server/session.js";
import { latestTenantChannel } from "../../../../src/server/whatsapp-repository.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const channel = await latestTenantChannel(auth.session.tenantId);
  if (!channel) {
    return Response.json({ ok: true, status: "disconnected", providerState: "no_channel", code: "WHATSAPP_CHANNEL_REQUIRED" });
  }
  return Response.json({
    ok: true,
    status: channel.status || "disconnected",
    provider: channel.provider,
    providerState: "official_meta_webhook",
    lastHealthCheckAt: channel.lastHealthCheckAt || null
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
