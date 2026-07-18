import {
  evolutionConnect,
  evolutionConnectionState,
  evolutionRecreateInstance,
  extractEvolutionQr,
  isEvolutionAuthFailed,
  isEvolutionInstanceMissing,
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
  return { code: "QR_GENERATION_FAILED", status: 502, message: "تعذر إنشاء الباركود حاليًا. حاول مرة أخرى." };
}

export async function GET(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
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
      await updateChannel(id, auth.session.tenantId, { status: "connected", qrBase64: null, lastError: null });
      await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "qr", sourceId: id });
      return Response.json({ ok: true, type: "connected", status: "connected", instanceId: id, message: "الجهاز متصل بالفعل." });
    }

    // Always replace a non-connected provider session. This prevents a QR from
    // being returned from a previous pairing-code attempt (and vice versa).
    responseBody = await evolutionRecreateInstance(channel.instanceName, { qrcode: true });
    connectionState = providerState(responseBody) || connectionState;
    let qrDataUri = await extractEvolutionQr(responseBody);
    if (!qrDataUri) {
      responseBody = await evolutionConnect(channel.instanceName, undefined, 20_000);
      connectionState = providerState(responseBody) || connectionState;
      qrDataUri = await extractEvolutionQr(responseBody);
    }

    if (!qrDataUri) {
      const message = "Link service returned no valid QR payload";
      await updateChannel(id, auth.session.tenantId, { status: "error", qrBase64: null, lastError: message });
      await recordOperationalIssue({
        tenantId: auth.session.tenantId,
        category: "qr",
        source: "whatsapp_link",
        sourceId: id,
        message,
        suggestedSolution: "Retry QR generation for the current channel.",
        metadata: {
          operation: "qr_generation",
          instanceNameMasked: maskedInstanceName(channel.instanceName),
          responseKeys: Object.keys(responseBody || {}).slice(0, 20),
          connectionState,
          durationMs: Date.now() - startedAt
        }
      });
      return Response.json({ ok: false, code: "QR_NOT_RETURNED", message: "لم تُرجع خدمة الربط باركودًا صالحًا لهذه الجلسة." }, { status: 502 });
    }

    await updateChannel(id, auth.session.tenantId, {
      status: "pending_qr",
      qrBase64: null,
      lastQrGeneratedAt: new Date(),
      lastError: null
    });
    await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "qr", sourceId: id });
    await addWhatsAppActivity({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      type: "whatsapp.qr_generated",
      title: "WhatsApp QR generated for a fresh session"
    }).catch(() => null);
    const expiresIn = 60;
    return Response.json({
      ok: true,
      type: "qr",
      status: "pending_qr",
      instanceId: id,
      qr: qrDataUri,
      qrDataUri,
      qrBase64: qrDataUri,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
    });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    const failure = linkFailure(error);
    console.error("WhatsApp QR generation failed", errorMessage);
    await updateChannel(id, auth.session.tenantId, { status: "error", qrBase64: null, lastError: errorMessage });
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "whatsapp.qr_failed", title: "WhatsApp QR generation failed" }).catch(() => null);
    await recordOperationalIssue({
      tenantId: auth.session.tenantId,
      category: "qr",
      source: "whatsapp_link",
      sourceId: id,
      message: errorMessage,
      suggestedSolution: "Check the server-side link service configuration, then retry.",
      metadata: {
        operation: "qr_generation",
        instanceNameMasked: maskedInstanceName(channel.instanceName),
        connectionState,
        durationMs: Date.now() - startedAt,
        errorCode: failure.code
      }
    }).catch(() => null);
    return Response.json({ ok: false, code: failure.code, message: failure.message }, { status: failure.status });
  }
}
