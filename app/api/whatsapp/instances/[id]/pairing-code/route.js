import { normalizeEvolutionPhone } from "../../../../../../src/lib/evolution.js";
import { evolutionConnectionState, evolutionPairingCode, isEvolutionPairingUnsupported, isEvolutionTimeout, isEvolutionUnreachable } from "../../../../../../src/server/evolution-client.js";
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
    return Response.json({ ok: true, type: "connected", status: "connected", code: "INSTANCE_ALREADY_CONNECTED", message: "الجهاز متصل بالفعل." });
  }

  const startedAt = Date.now();
  const providerConnection = await evolutionConnectionState(channel.instanceName, 4_000).catch(() => null);
  const providerState = providerConnection?.instance?.state || providerConnection?.state || null;
  if (["open", "connected"].includes(providerState)) {
    await updateChannel(id, auth.session.tenantId, { status: "connected", lastError: null });
    await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "pairing_code", sourceId: id });
    return Response.json({ ok: true, type: "connected", status: "connected", code: "INSTANCE_ALREADY_CONNECTED", message: "الجهاز متصل بالفعل." });
  }

  try {
    const result = await evolutionPairingCode(channel.instanceName, normalized.phoneNumber, 15_000);
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
        responseKeys: Object.keys(response).slice(0, 20),
        operation: "pairing_code",
        connectionState: providerState,
        durationMs: Date.now() - startedAt,
        errorMessage: message
      };
      await updateChannel(id, auth.session.tenantId, { lastError: message });
      await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.pairing_not_returned", title: "WhatsApp pairing code was not returned" }).catch(() => null);
      await recordOperationalIssue({ tenantId: auth.session.tenantId, category: "pairing_code", source: "evolution", sourceId: id, severity: "warning", message, suggestedSolution: "Retry pairing code generation for the same instance or use its current QR code.", metadata });
      return Response.json({ ok: false, code: "PAIRING_CODE_NOT_RETURNED", message: "لم يرجع Evolution رمز اقتران لهذه المحاولة. حاول مرة أخرى أو استخدم الباركود." }, { status: 409 });
    }

    await updateChannel(id, auth.session.tenantId, { status: "pending_pairing", phoneNumber: normalized.phoneNumber, lastPairingCodeGeneratedAt: new Date(), lastError: null });
    await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "pairing_code", sourceId: id });
    return Response.json({ ok: true, type: "pairing", instanceId: id, pairingCode: result.pairingCode, expiresIn: 60, phoneNumber: normalized.phoneNumber });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    const unsupported = isEvolutionPairingUnsupported(error);
    const timeout = isEvolutionTimeout(error);
    const unreachable = isEvolutionUnreachable(error);
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
        httpStatus: Number(errorMessage.match(/Evolution API (\d{3}):/)?.[1] || 0) || null,
        operation: "pairing_code",
        responseKeys: [],
        hasBase64: false,
        hasPairingCode: false,
        hasCode: false,
        connectionState: providerState,
        durationMs: Date.now() - startedAt,
        errorMessage
      }
    }).catch(() => null);
    if (unsupported) return Response.json({ ok: false, code: "PAIRING_CODE_NOT_SUPPORTED", message: "رمز الاقتران غير مدعوم حاليًا في نسخة Evolution API المثبتة. يمكنك استخدام الربط بالباركود." }, { status: 501 });
    if (timeout) return Response.json({ ok: false, code: "EVOLUTION_TIMEOUT", message: "استغرق Evolution وقتًا أطول من المتوقع. حاول مرة أخرى." }, { status: 504 });
    if (unreachable) return Response.json({ ok: false, code: "EVOLUTION_UNREACHABLE", message: "تعذر الوصول إلى خدمة Evolution حاليًا. تحقق من تشغيل الخادم ثم حاول مرة أخرى." }, { status: 503 });
    return Response.json({ ok: false, code: "PAIRING_CODE_FAILED", message: "تعذر إنشاء رمز الاقتران لهذه المحاولة. حاول مرة أخرى دون تغيير الجهاز." }, { status: 502 });
  }
}
