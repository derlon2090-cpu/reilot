import {
  evolutionConnect,
  evolutionConnectionState,
  evolutionCreateInstance,
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

function evolutionFailure(error) {
  if (isEvolutionAuthFailed(error)) return { code: "EVOLUTION_AUTH_FAILED", status: 502, message: "فشل التحقق من مفتاح خدمة الربط." };
  if (isEvolutionTimeout(error)) return { code: "EVOLUTION_TIMEOUT", status: 504, message: "استغرقت خدمة Evolution وقتًا أطول من المتوقع. حاول مرة أخرى." };
  if (isEvolutionUnreachable(error)) return { code: "EVOLUTION_UNREACHABLE", status: 503, message: "تعذر الوصول إلى خدمة Evolution حاليًا. تحقق من تشغيل الخادم ثم حاول مرة أخرى." };
  return { code: "QR_GENERATION_FAILED", status: 502, message: "تعذر إنشاء الباركود من Evolution API. حاول مرة أخرى." };
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
  let recreated = false;
  try {
    try {
      const connection = await evolutionConnectionState(channel.instanceName, 5_000);
      connectionState = providerState(connection);
    } catch (error) {
      if (!isEvolutionInstanceMissing(error)) throw error;
      responseBody = await evolutionCreateInstance(channel.instanceName, { qrcode: true });
      recreated = true;
      connectionState = providerState(responseBody);
    }

    if (["open", "connected"].includes(connectionState)) {
      await updateChannel(id, auth.session.tenantId, { status: "connected", qrBase64: null, lastError: null });
      await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "qr", sourceId: id });
      return Response.json({ ok: true, type: "connected", status: "connected", instanceId: id, instanceName: channel.instanceName, message: "الجهاز متصل بالفعل." });
    }

    let qrDataUri = await extractEvolutionQr(responseBody);
    if (!qrDataUri) {
      responseBody = await evolutionConnect(channel.instanceName, undefined, 20_000);
      connectionState = providerState(responseBody) || connectionState;
      if (["open", "connected"].includes(connectionState)) {
        await updateChannel(id, auth.session.tenantId, { status: "connected", qrBase64: null, lastError: null });
        await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "qr", sourceId: id });
        return Response.json({ ok: true, type: "connected", status: "connected", instanceId: id, instanceName: channel.instanceName, message: "الجهاز متصل بالفعل." });
      }
      qrDataUri = await extractEvolutionQr(responseBody);
    }

    if (!qrDataUri) {
      const message = "Evolution API returned no valid QR image or QR code";
      await updateChannel(id, auth.session.tenantId, { status: "error", qrBase64: null, lastError: message });
      await recordOperationalIssue({
        tenantId: auth.session.tenantId,
        category: "qr",
        source: "evolution",
        sourceId: id,
        message,
        suggestedSolution: "Retry QR generation using the same instance.",
        metadata: {
          operation: "qr_generation",
          instanceNameMasked: maskedInstanceName(channel.instanceName),
          responseKeys: Object.keys(responseBody || {}).slice(0, 20),
          connectionState,
          recreated,
          durationMs: Date.now() - startedAt
        }
      });
      return Response.json({ ok: false, code: "QR_NOT_RETURNED", message: "لم تُرجع خدمة Evolution باركودًا صالحًا لهذه الجلسة." }, { status: 502 });
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
      type: recreated ? "evolution.instance_recreated" : "evolution.qr_generated",
      title: recreated ? "Evolution instance recreated for QR linking" : "WhatsApp QR generated"
    }).catch(() => null);
    const expiresIn = 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    return Response.json({
      ok: true,
      type: "qr",
      status: "pending_qr",
      instanceId: id,
      instanceName: channel.instanceName,
      qr: qrDataUri,
      qrDataUri,
      qrBase64: qrDataUri,
      expiresIn,
      expiresAt
    });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    const failure = evolutionFailure(error);
    console.error("evolution QR failed", errorMessage);
    await updateChannel(id, auth.session.tenantId, { status: "error", qrBase64: null, lastError: errorMessage });
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.qr_failed", title: "WhatsApp QR generation failed" }).catch(() => null);
    await recordOperationalIssue({
      tenantId: auth.session.tenantId,
      category: "qr",
      source: "evolution",
      sourceId: id,
      message: errorMessage,
      suggestedSolution: "Check Evolution API connectivity and server-side credentials, then retry.",
      metadata: {
        operation: "qr_generation",
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
