import { evolutionConnectionState } from "../../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";
import { addWhatsAppActivity, ownedChannel, updateChannel } from "../../../../../../src/server/whatsapp-repository.js";

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel) return Response.json({ ok: false, message: "Instance not found" }, { status: 404 });
  try {
    const result = await evolutionConnectionState(channel.instanceName);
    const providerState = result?.instance?.state || result?.state || "disconnected";
    const status = ["open", "connected"].includes(providerState) ? "connected" : providerState === "connecting" ? "connecting" : "disconnected";
    const updated = await updateChannel(id, auth.session.tenantId, { status, qrBase64: status === "connected" ? null : undefined, lastError: null });
    if (status === "connected") await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.connected", title: "WhatsApp connected" });
    return Response.json({ ok: true, instanceId: id, status, phoneNumber: updated?.phoneNumber || null, checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error("evolution check failed", safeErrorMessage(error));
    await updateChannel(id, auth.session.tenantId, { status: "error", lastError: safeErrorMessage(error) });
    return Response.json({ ok: false, message: "Unable to check WhatsApp connection" }, { status: 502 });
  }
}
