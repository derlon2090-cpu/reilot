import { normalizeEvolutionPhone } from "../../../../../../src/lib/evolution.js";
import { evaluateMessageQuality } from "../../../../../../src/lib/messageSafety.js";
import { evolutionSendText } from "../../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";
import { addWhatsAppActivity, ownedChannel } from "../../../../../../src/server/whatsapp-repository.js";

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const normalized = normalizeEvolutionPhone(body.to);
  if (!normalized.ok) return Response.json({ ok: false, message: "Invalid WhatsApp number" }, { status: 400 });
  const message = String(body.message || "").trim();
  if (!message || message.length > 1000) return Response.json({ ok: false, message: "Invalid message" }, { status: 400 });
  const quality = evaluateMessageQuality(message);
  if (quality.score === "risk") return Response.json({ ok: false, message: "Message blocked by the safety checker", quality }, { status: 422 });
  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel || channel.status !== "connected") return Response.json({ ok: false, message: "WhatsApp is not connected" }, { status: 409 });
  try {
    const sent = await evolutionSendText(channel.instanceName, normalized.phoneNumber, message);
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.test_sent", title: "WhatsApp test message sent", metadata: { providerMessageId: sent?.key?.id || sent?.id || null } });
    return Response.json({ ok: true, providerMessageId: sent?.key?.id || sent?.id || null });
  } catch (error) {
    console.error("evolution test message failed", safeErrorMessage(error));
    return Response.json({ ok: false, message: "Unable to send test message" }, { status: 502 });
  }
}
