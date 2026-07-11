import { normalizeEvolutionPhone } from "../../../../../../src/lib/evolution.js";
import { evolutionConnect } from "../../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";
import { recordOperationalIssue, resolveOperationalIssues } from "../../../../../../src/server/operations.js";
import { ownedChannel, updateChannel } from "../../../../../../src/server/whatsapp-repository.js";

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const normalized = normalizeEvolutionPhone(body.phoneNumber);
  if (!normalized.ok) return Response.json({ ok: false, code: normalized.code, message: "رقم واتساب غير صحيح." }, { status: 400 });
  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel) return Response.json({ ok: false, message: "Instance not found" }, { status: 404 });
  try {
    const result = await evolutionConnect(channel.instanceName, normalized.phoneNumber);
    if (!result?.pairingCode) {
      await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "pairing_code", source: "evolution", sourceId: id, severity: "warning", message: "Evolution API did not return a pairing code", suggestedSolution: "Use the QR connection method with the installed Evolution API version." });
      return Response.json({ ok: false, code: "PAIRING_CODE_NOT_SUPPORTED", message: "Pairing Code is not supported by the installed Evolution API version. Use QR linking." }, { status: 501 });
    }
    await updateChannel(id, auth.session.tenantId, { status: "pending_pairing", phoneNumber: normalized.phoneNumber, lastPairingCodeGeneratedAt: new Date(), lastError: null });
    await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "pairing_code", sourceId: id });
    return Response.json({ ok: true, instanceId: id, pairingCode: result.pairingCode, expiresIn: 60, phoneNumber: normalized.phoneNumber });
  } catch (error) {
    console.error("evolution pairing failed", safeErrorMessage(error));
    await updateChannel(id, auth.session.tenantId, { status: "error", lastError: safeErrorMessage(error) });
    await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "pairing_code", source: "evolution", sourceId: id, message: safeErrorMessage(error), suggestedSolution: "Check Evolution API support or use QR linking." }).catch(() => null);
    return Response.json({ ok: false, message: "Unable to generate pairing code" }, { status: 502 });
  }
}
