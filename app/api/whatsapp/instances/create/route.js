import { requireSession } from "../../../../../src/server/session.js";
import { latestTenantChannel, recentDeviceActivity, tenantChannels, withoutExpiredQr } from "../../../../../src/server/whatsapp-repository.js";
import { evolutionUnavailableToUsers } from "../../../../../src/server/user-evolution-guard.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const [latest, devices, activity] = await Promise.all([
    latestTenantChannel(auth.session.tenantId),
    tenantChannels(auth.session.tenantId),
    recentDeviceActivity(auth.session.tenantId)
  ]);
  return Response.json({
    ok: true,
    instance: latest ? { ...withoutExpiredQr(latest), devices, activity } : { devices, activity }
  });
}

export async function POST(req) {
  return evolutionUnavailableToUsers(req);
}
