import { normalizeEvolutionPhone } from "../../../../../../src/lib/evolution.js";
import { evolutionPairingCode } from "../../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";
import { recordOperationalIssue, resolveOperationalIssues } from "../../../../../../src/server/operations.js";
import { addWhatsAppActivity, ownedChannel, updateChannel } from "../../../../../../src/server/whatsapp-repository.js";

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const normalized = normalizeEvolutionPhone(body.phoneNumber);
  if (!normalized.ok) return Response.json({ ok: false, code: normalized.code, message: "اكتب الرقم بصيغة دولية بدون + أو مسافات." }, { status: 400 });
  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel) return Response.json({ ok: false, message: "Instance not found" }, { status: 404 });
  try {
    const result = await evolutionPairingCode(channel.instanceName, normalized.phoneNumber);
    if (!result.pairingCode) {
      await updateChannel(id, auth.session.tenantId, { lastError: "Evolution API returned QR data without a valid pairing code" });
      await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.pairing_failed", title: "WhatsApp pairing code is not supported" }).catch(() => null);
      await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "pairing_code", source: "evolution", sourceId: id, severity: "warning", message: "Evolution API returned QR data without a valid pairing code", suggestedSolution: "Use QR linking or upgrade Evolution only after reviewing licensing requirements." });
      return Response.json({ ok: false, code: "PAIRING_CODE_NOT_SUPPORTED", message: "رمز الاقتران غير مدعوم حاليًا في نسخة Evolution API المثبتة. يمكنك استخدام الربط بالباركود." }, { status: 501 });
    }
    await updateChannel(id, auth.session.tenantId, { status: "pending_pairing", phoneNumber: normalized.phoneNumber, lastPairingCodeGeneratedAt: new Date(), lastError: null });
    await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "pairing_code", sourceId: id });
    return Response.json({ ok: true, instanceId: id, pairingCode: result.pairingCode, expiresIn: 60, phoneNumber: normalized.phoneNumber });
  } catch (error) {
    console.error("evolution pairing failed", safeErrorMessage(error));
    await updateChannel(id, auth.session.tenantId, { status: "error", lastError: safeErrorMessage(error) });
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.pairing_failed", title: "WhatsApp pairing code generation failed" }).catch(() => null);
    await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "pairing_code", source: "evolution", sourceId: id, message: safeErrorMessage(error), suggestedSolution: "Check Evolution API support or use QR linking." }).catch(() => null);
    return Response.json({ ok: false, message: "تعذر إنشاء رمز الاقتران، حاول استخدام الباركود." }, { status: 502 });
  }
}
