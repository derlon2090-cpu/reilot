import { normalizeEvolutionPhone } from "../../../../../../src/lib/evolution.js";
import {
  evolutionConnectionState,
  evolutionPairingCode,
  evolutionRecreateInstance,
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

function linkFailure(error) {
  if (isEvolutionAuthFailed(error)) return { code: "LINK_AUTH_FAILED", status: 502, message: "فشل التحقق من إعدادات خدمة الربط." };
  if (isEvolutionTimeout(error)) return { code: "LINK_TIMEOUT", status: 504, message: "استغرقت خدمة الربط وقتًا أطول من المتوقع. حاول مرة أخرى." };
  if (isEvolutionUnreachable(error)) return { code: "LINK_UNREACHABLE", status: 503, message: "تعذر الوصول إلى خدمة الربط حاليًا. حاول مرة أخرى لاحقًا." };
  if (isEvolutionPairingUnsupported(error)) return { code: "PAIRING_CODE_NOT_SUPPORTED", status: 501, message: "رمز الاقتران غير مدعوم حاليًا. يمكنك استخدام الربط بالباركود." };
  return { code: "PAIRING_CODE_FAILED", status: 502, message: "تعذر إنشاء رمز الاقتران حاليًا. حاول مرة أخرى دون تغيير الجهاز." };
}

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const normalized = normalizeEvolutionPhone(body.phoneNumber);
  if (!normalized.ok) {
    return Response.json({ ok: false, code: "INVALID_PHONE", message: "اكتب الرقم بصيغة دولية صحيحة أو بصيغة محلية سعودية." }, { status: 400 });
  }

  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel) return Response.json({ ok: false, code: "WHATSAPP_CHANNEL_NOT_FOUND", message: "قناة واتساب غير موجودة." }, { status: 404 });

  const startedAt = Date.now();
  let connectionState = null;
  let responseBody = null;
  try {
    try {
      const connection = await evolutionConnectionState(channel.instanceName, 5_000);
      connectionState = providerState(connection);
    } catch (error) {
      if (!isEvolutionInstanceMissing(error)) throw error;
    }

    if (["open", "connected"].includes(connectionState)) {
      await updateChannel(id, auth.session.tenantId, { status: "connected", phoneNumber: normalized.phoneNumber, lastError: null });
      await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "pairing_code", sourceId: id });
      return Response.json({ ok: true, type: "connected", status: "connected", code: "INSTANCE_ALREADY_CONNECTED", message: "الجهاز متصل بالفعل." });
    }

    // Pairing codes are valid only for the freshly created phone-number session.
    // Replacing a non-connected QR/pairing session prevents stale, unusable codes.
    responseBody = await evolutionRecreateInstance(channel.instanceName, {
      qrcode: false,
      phoneNumber: normalized.phoneNumber
    });
    connectionState = providerState(responseBody) || connectionState;
    let pairingCode = extractEvolutionPairingCode(responseBody);
    if (!pairingCode) {
      const result = await evolutionPairingCode(channel.instanceName, normalized.phoneNumber, 20_000);
      responseBody = result.body;
      pairingCode = result.pairingCode;
      connectionState = providerState(responseBody) || connectionState;
    }

    if (!pairingCode) {
      const message = "Link service returned no valid pairing code";
      await updateChannel(id, auth.session.tenantId, { status: "error", phoneNumber: normalized.phoneNumber, lastError: message });
      await recordOperationalIssue({
        tenantId: auth.session.tenantId,
        category: "pairing_code",
        source: "whatsapp_link",
        sourceId: id,
        severity: "warning",
        message,
        suggestedSolution: "Retry pairing with the current channel or use QR linking.",
        metadata: {
          operation: "pairing_code",
          instanceNameMasked: maskedInstanceName(channel.instanceName),
          responseKeys: Object.keys(responseBody || {}).slice(0, 20),
          connectionState,
          durationMs: Date.now() - startedAt
        }
      });
      return Response.json({ ok: false, code: "PAIRING_CODE_NOT_RETURNED", message: "لم تُرجع خدمة الربط رمز اقتران صالحًا لهذه الجلسة. حاول مرة أخرى أو استخدم الباركود." }, { status: 409 });
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
      type: "whatsapp.pairing_generated",
      title: "WhatsApp pairing code generated for a fresh session"
    }).catch(() => null);
    return Response.json({
      ok: true,
      type: "pairing",
      status: "pending_pairing",
      instanceId: id,
      pairingCode,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      phoneNumber: normalized.phoneNumber
    });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    const failure = linkFailure(error);
    console.error("WhatsApp pairing generation failed", errorMessage);
    await updateChannel(id, auth.session.tenantId, { status: "error", phoneNumber: normalized.phoneNumber, lastError: errorMessage });
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "whatsapp.pairing_failed", title: "WhatsApp pairing code generation failed" }).catch(() => null);
    await recordOperationalIssue({
      tenantId: auth.session.tenantId,
      category: "pairing_code",
      source: "whatsapp_link",
      sourceId: id,
      message: errorMessage,
      suggestedSolution: failure.code === "PAIRING_CODE_NOT_SUPPORTED" ? "Use QR linking for the current channel." : "Check the server-side link service configuration, then retry.",
      metadata: {
        operation: "pairing_code",
        instanceNameMasked: maskedInstanceName(channel.instanceName),
        connectionState,
        durationMs: Date.now() - startedAt,
        errorCode: failure.code
      }
    }).catch(() => null);
    return Response.json({ ok: false, code: failure.code, message: failure.message }, { status: failure.status });
  }
}
