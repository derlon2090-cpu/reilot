import { requireSession } from "../../../../../src/server/session.js";
import { addWhatsAppActivity, createChannel, evolutionInstanceName, latestTenantChannel, recentDeviceActivity, tenantChannels, withoutExpiredQr } from "../../../../../src/server/whatsapp-repository.js";
import { assertPlanCapacity, planEntitlementResponse } from "../../../../../src/server/plan-entitlements.js";

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
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const existing = await latestTenantChannel(auth.session.tenantId);
  if (existing) {
    return Response.json({ ok: true, instance: withoutExpiredQr(existing), existing: true });
  }
  try { await assertPlanCapacity(auth.session.tenantId, "whatsappChannels"); }
  catch (error) { const response = planEntitlementResponse(error); if (response) return response; throw error; }
  try {
    const instanceName = evolutionInstanceName(auth.session.tenantId);
    const channel = await createChannel({
      tenantId: auth.session.tenantId,
      instanceName,
      qrBase64: null
    });
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "whatsapp.channel_created", title: "WhatsApp linking channel created" });
    return Response.json({ ok: true, instance: channel }, { status: 201 });
  } catch (error) {
    console.error("WhatsApp channel create failed", error?.name || "unknown_error");
    return Response.json({ ok: false, message: "تعذر إنشاء قناة الربط حاليًا." }, { status: 500 });
  }
}
