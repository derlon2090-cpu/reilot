import { normalizeEvolutionPhone } from "../../../../../../src/lib/evolution.js";
import {
  evolutionConnectionState,
  evolutionCreateInstance,
  evolutionPairingCode,
  extractEvolutionPairingCode,
  isEvolutionAuthFailed,
  isEvolutionInstanceMissing,
  isEvolutionPairingUnsupported,
  isEvolutionTimeout,
  isEvolutionUnreachable
} from "../../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";
import { recordOperationalIssue, resolveOperationalIssues } from "../../../../../../src/server/operations.js";
import { addWhatsAppActivity, ownedChannel, updateChannel } from "../../../../../../src/server/whatsapp-repository.js";

function providerState(body) {
  return body?.instance?.state || body?.state || body?.data?.instance?.state || null;
}

function maskedInstanceName(instanceName) {
  return `${instanceName.slice(0, 12)}...${instanceName.slice(-5)}`;
}

function evolutionFailure(error) {
  if (isEvolutionAuthFailed(error)) return { code: "EVOLUTION_AUTH_FAILED", status: 502, message: "فشل التحقق من مفتاح خدمة الربط." };
  if (isEvolutionTimeout(error)) return { code: "EVOLUTION_TIMEOUT", status: 504, message: "استغرقت خدمة Evolution وقتًا أطول من المتوقع. حاول مرة أخرى." };
  if (isEvolutionUnreachable(error)) return { code: "EVOLUTION_UNREACHABLE", status: 503, message: "تعذر الوصول إلى خدمة Evolution حاليًا. تحقق من تشغيل الخادم ثم حاول مرة أخرى." };
  if (isEvolutionPairingUnsupported(error)) return { code: "PAIRING_CODE_NOT_SUPPORTED", status: 501, message: "رمز الاقتران غير مدعوم حاليًا في نسخة Evolution API المثبتة. يمكنك استخدام الربط بالباركود." };
  return { code: "PAIRING_CODE_FAILED", status: 502, message: "تعذر إنشاء رمز الاقتران من Evolution API. حاول مرة أخرى دون تغيير الجهاز." };
}

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const normalized = normalizeEvolutionPhone(body.phoneNumber);
  if (!normalized.ok) {
    return Response.json({ ok: false, code: "INVALID_PHONE", message: "الرجاء إدخال رقم واتساب صحيح." }, { status: 400 });
  }

  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel) return Response.json({ ok: false, code: "WHATSAPP_CHANNEL_NOT_FOUND", message: "قناة واتساب غير موجودة." }, { status: 404 });

  const startedAt = Date.now();
  let connectionState = null;
  let responseBody = null;
  let recreated = false;
  try {
    try {
      const connection = await evolutionConnectionState(channel.instanceName, 5_000);
      connectionState = providerState(connection);
    } catch (error) {
      if (!isEvolutionInstanceMissing(error)) throw error;
      responseBody = await evolutionCreateInstance(channel.instanceName, {
        qrcode: false,
        phoneNumber: normalized.phoneNumber
      });
      recreated = true;
      connectionState = providerState(responseBody);
    }

    if (["open", "connected"].includes(connectionState)) {
      await updateChannel(id, auth.session.tenantId, { status: "connected", phoneNumber: normalized.phoneNumber, lastError: null });
      await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "pairing_code", sourceId: id });
      return Response.json({ ok: true, type: "connected", status: "connected", code: "INSTANCE_ALREADY_CONNECTED", instanceName: channel.instanceName, message: "الجهاز متصل بالفعل." });
    }

    let pairingCode = extractEvolutionPairingCode(responseBody);
    if (!pairingCode) {
      const result = await evolutionPairingCode(channel.instanceName, normalized.phoneNumber, 20_000);
      responseBody = result.body;
      pairingCode = result.pairingCode;
      connectionState = providerState(responseBody) || connectionState;
    }

    if (!pairingCode) {
      const message = "Evolution API returned HTTP 200 without a valid pairing code";
      await updateChannel(id, auth.session.tenantId, { status: "error", phoneNumber: normalized.phoneNumber, lastError: message });
      await recordOperationalIssue({
        tenantId: auth.session.tenantId,
        category: "pairing_code",
        source: "evolution",
        sourceId: id,
        severity: "warning",
        message,
        suggestedSolution: "Retry pairing code generation with the same instance or use QR linking.",
        metadata: {
          operation: "pairing_code",
          instanceNameMasked: maskedInstanceName(channel.instanceName),
          responseKeys: Object.keys(responseBody || {}).slice(0, 20),
          connectionState,
          recreated,
          durationMs: Date.now() - startedAt
        }
      });
      return Response.json({ ok: false, code: "PAIRING_CODE_NOT_RETURNED", message: "لم تُرجع خدمة Evolution رمز اقتران لهذه الجلسة. حاول مرة أخرى أو استخدم الباركود." }, { status: 409 });
    }

    const expiresIn = 60;
    await updateChannel(id, auth.session.tenantId, {
      status: "pending_pairing",
      phoneNumber: normalized.phoneNumber,
      lastPairingCodeGeneratedAt: new Date(),
      lastError: null
    });
    await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "pairing_code", sourceId: id });
    await addWhatsAppActivity({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      type: recreated ? "evolution.instance_recreated" : "evolution.pairing_generated",
      title: recreated ? "Evolution instance recreated for pairing" : "WhatsApp pairing code generated"
    }).catch(() => null);
    return Response.json({
      ok: true,
      type: "pairing",
      status: "pending_pairing",
      instanceId: id,
      instanceName: channel.instanceName,
      pairingCode,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      phoneNumber: normalized.phoneNumber
    });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    const failure = evolutionFailure(error);
    console.error("evolution pairing failed", errorMessage);
    await updateChannel(id, auth.session.tenantId, { status: "error", phoneNumber: normalized.phoneNumber, lastError: errorMessage });
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.pairing_failed", title: "WhatsApp pairing code generation failed" }).catch(() => null);
    await recordOperationalIssue({
      tenantId: auth.session.tenantId,
      category: "pairing_code",
      source: "evolution",
      sourceId: id,
      message: errorMessage,
      suggestedSolution: failure.code === "PAIRING_CODE_NOT_SUPPORTED" ? "Use QR linking with the same instance." : "Check Evolution connectivity and server-side credentials, then retry.",
      metadata: {
        operation: "pairing_code",
        instanceNameMasked: maskedInstanceName(channel.instanceName),
        connectionState,
        recreated,
        durationMs: Date.now() - startedAt,
        errorCode: failure.code
      }
    }).catch(() => null);
    return Response.json({ ok: false, code: failure.code, message: failure.message }, { status: failure.status });
  }
}
