import { evolutionCreateInstance } from "../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../src/server/security.js";
import { addWhatsAppActivity, createChannel, evolutionInstanceName, latestTenantChannel } from "../../../../../src/server/whatsapp-repository.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  return Response.json({ ok: true, instance: await latestTenantChannel(auth.session.tenantId) });
}

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const existing = await latestTenantChannel(auth.session.tenantId);
  if (existing) return Response.json({ ok: true, instance: existing, existing: true });
  try {
    const instanceName = evolutionInstanceName(auth.session.tenantId);
    const created = await evolutionCreateInstance(instanceName);
    const qrBase64 = created?.qrcode?.base64 || null;
    const channel = await createChannel({
      tenantId: auth.session.tenantId,
      instanceName: created?.instance?.instanceName || instanceName,
      providerToken: created?.hash,
      qrBase64
    });
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.created", title: "Evolution instance created" });
    return Response.json({ ok: true, instance: { ...channel, qrBase64 } }, { status: 201 });
  } catch (error) {
    console.error("evolution create failed", safeErrorMessage(error));
    return Response.json({ ok: false, message: "Unable to create WhatsApp instance" }, { status: 502 });
  }
}
