import { evolutionLogout } from "../../../../../../src/server/evolution-client.js";
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
    await evolutionLogout(channel.instanceName);
    await updateChannel(id, auth.session.tenantId, { status: "disconnected", qrBase64: null, lastError: null });
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.disconnected", title: "WhatsApp disconnected" });
    return Response.json({ ok: true, instanceId: id, status: "disconnected" });
  } catch (error) {
    console.error("evolution disconnect failed", safeErrorMessage(error));
    return Response.json({ ok: false, message: "Unable to disconnect WhatsApp" }, { status: 502 });
  }
}
