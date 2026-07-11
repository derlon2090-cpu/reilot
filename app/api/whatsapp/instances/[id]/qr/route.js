import { evolutionConnect, normalizeEvolutionQr } from "../../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";
import { recordOperationalIssue, resolveOperationalIssues } from "../../../../../../src/server/operations.js";
import { addWhatsAppActivity } from "../../../../../../src/server/whatsapp-repository.js";
import { ownedChannel, updateChannel } from "../../../../../../src/server/whatsapp-repository.js";

export async function GET(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel) return Response.json({ ok: false, message: "Instance not found" }, { status: 404 });
  try {
    const qr = await evolutionConnect(channel.instanceName);
    const qrBase64 = normalizeEvolutionQr(qr?.base64 || qr?.qrcode?.base64);
    if (!qrBase64) {
      const message = "Evolution API did not return a valid QR image";
      await updateChannel(id, auth.session.tenantId, { status: "error", qrBase64: null, lastError: message });
      await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.qr_failed", title: "WhatsApp QR generation failed" });
      await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "qr", source: "evolution", sourceId: id, message, suggestedSolution: "Check Evolution API health and create a new QR code." });
      return Response.json({ ok: false, message: "Unable to generate a valid QR code from Evolution API" }, { status: 502 });
    }
    await updateChannel(id, auth.session.tenantId, { status: "pending_qr", qrBase64, lastQrGeneratedAt: new Date(), lastError: null });
    await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "qr", sourceId: id });
    return Response.json({ ok: true, instanceId: id, qrBase64, pairingCode: qr?.pairingCode || null, expiresIn: 60 });
  } catch (error) {
    console.error("evolution QR failed", safeErrorMessage(error));
    await updateChannel(id, auth.session.tenantId, { status: "error", qrBase64: null, lastError: safeErrorMessage(error) });
    await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "qr", source: "evolution", sourceId: id, message: safeErrorMessage(error), suggestedSolution: "Check Evolution API connectivity and retry QR generation." }).catch(() => null);
    return Response.json({ ok: false, message: "Unable to generate QR code" }, { status: 502 });
  }
}
