import { normalizeEvolutionPhone } from "../../../../../../src/lib/evolution.js";
import { evolutionPairingCode, isEvolutionPairingUnsupported } from "../../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";
import { recordOperationalIssue, resolveOperationalIssues } from "../../../../../../src/server/operations.js";
import { addWhatsAppActivity, ownedChannel, updateChannel } from "../../../../../../src/server/whatsapp-repository.js";

function maskedInstanceName(instanceName) {
  return `${instanceName.slice(0, 12)}...${instanceName.slice(-5)}`;
}

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const normalized = normalizeEvolutionPhone(body.phoneNumber);
  if (!normalized.ok) return Response.json({ ok: false, code: normalized.code, message: "اكتب الرقم بصيغة دولية بدون + أو مسافات." }, { status: 400 });
  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel) return Response.json({ ok: false, message: "Instance not found" }, { status: 404 });
  if (channel.status === "connected") {
    return Response.json({ ok: false, code: "INSTANCE_ALREADY_CONNECTED", message: "الجهاز متصل بالفعل ولا يحتاج إلى رمز اقتران جديد." }, { status: 409 });
  }

  try {
    const result = await evolutionPairingCode(channel.instanceName, normalized.phoneNumber);
    if (!result.pairingCode) {
      const response = result.body || {};
      const message = "Evolution API returned HTTP 200 without a valid pairing code for this session";
      const metadata = {
        instanceNameMasked: maskedInstanceName(channel.instanceName),
        httpStatus: 200,
        hasBase64: Boolean(response.base64 || response?.qrcode?.base64),
        hasCode: Boolean(response.code || response?.data?.code),
        hasPairingCode: Boolean(response.pairingCode || response.pairing_code || response.codePairing || response?.data?.pairingCode),
        pairingCodeIsNull: response.pairingCode === null,
        responseKeys: Object.keys(response).slice(0, 20)
      };
      await updateChannel(id, auth.session.tenantId, { lastError: message });
      await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.pairing_not_returned", title: "WhatsApp pairing code was not returned" }).catch(() => null);
      await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "pairing_code", source: "evolution", sourceId: id, severity: "warning", message, suggestedSolution: "Retry pairing code generation for the same instance or use its current QR code.", metadata });
      return Response.json({ ok: false, code: "PAIRING_CODE_NOT_RETURNED", message: "لم يرجع Evolution رمز الاقتران لهذه الجلسة. حاول إنشاء رمز جديد أو أعد ربط الجهاز." }, { status: 409 });
    }

    await updateChannel(id, auth.session.tenantId, { status: "pending_pairing", phoneNumber: normalized.phoneNumber, lastPairingCodeGeneratedAt: new Date(), lastError: null });
    await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "pairing_code", sourceId: id });
    return Response.json({ ok: true, instanceId: id, pairingCode: result.pairingCode, expiresIn: 60, phoneNumber: normalized.phoneNumber });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    const unsupported = isEvolutionPairingUnsupported(error);
    console.error("evolution pairing failed", errorMessage);
    await updateChannel(id, auth.session.tenantId, { lastError: errorMessage });
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.pairing_failed", title: "WhatsApp pairing code generation failed" }).catch(() => null);
    await recordOperationalIssue({
      tenantId: auth.session.tenantId,
      category: "pairing_code",
      source: "evolution",
      sourceId: id,
      message: errorMessage,
      suggestedSolution: unsupported ? "Use QR linking with the same instance." : "Retry pairing code generation and verify Evolution connectivity.",
      metadata: {
        instanceNameMasked: maskedInstanceName(channel.instanceName),
        httpStatus: Number(errorMessage.match(/Evolution API (\d{3}):/)?.[1] || 0) || null
      }
    }).catch(() => null);
    if (unsupported) return Response.json({ ok: false, code: "PAIRING_CODE_NOT_SUPPORTED", message: "رمز الاقتران غير مدعوم حاليًا في نسخة Evolution API المثبتة. يمكنك استخدام الربط بالباركود." }, { status: 501 });
    return Response.json({ ok: false, code: "PAIRING_CODE_FAILED", message: "تعذر إنشاء رمز الاقتران لهذه المحاولة. حاول مرة أخرى دون تغيير الجهاز." }, { status: 502 });
  }
}
