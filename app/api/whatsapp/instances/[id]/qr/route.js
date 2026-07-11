import { evolutionConnect } from "../../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";
import { ownedChannel, updateChannel } from "../../../../../../src/server/whatsapp-repository.js";

export async function GET(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel) return Response.json({ ok: false, message: "Instance not found" }, { status: 404 });
  try {
    const qr = await evolutionConnect(channel.instanceName);
    const qrBase64 = qr?.base64 || qr?.qrcode?.base64 || null;
    await updateChannel(id, auth.session.tenantId, { status: "pending_qr", qrBase64, lastError: null });
    return Response.json({ ok: true, instanceId: id, qrBase64, pairingCode: qr?.pairingCode || null, expiresIn: 60 });
  } catch (error) {
    console.error("evolution QR failed", safeErrorMessage(error));
    return Response.json({ ok: false, message: "Unable to generate QR code" }, { status: 502 });
  }
}
