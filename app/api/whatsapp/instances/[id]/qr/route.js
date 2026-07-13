import { evolutionConnect, evolutionConnectionState, isEvolutionTimeout, isEvolutionUnreachable, normalizeEvolutionQr } from "../../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";
import { recordOperationalIssue, resolveOperationalIssues } from "../../../../../../src/server/operations.js";
import { addWhatsAppActivity } from "../../../../../../src/server/whatsapp-repository.js";
import { ownedChannel, updateChannel } from "../../../../../../src/server/whatsapp-repository.js";

function maskedInstanceName(instanceName) {
  return `${instanceName.slice(0, 12)}...${instanceName.slice(-5)}`;
}

export async function GET(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel) return Response.json({ ok: false, message: "Instance not found" }, { status: 404 });
  if (channel.status === "connected") {
    return Response.json({ ok: true, type: "connected", status: "connected", instanceId: id, message: "الجهاز متصل بالفعل." });
  }
  const startedAt = Date.now();
  let connectionState = null;
  let qr = null;
  try {
    try {
      const connection = await evolutionConnectionState(channel.instanceName, 4_000);
      connectionState = connection?.instance?.state || connection?.state || null;
    } catch {}
    if (["open", "connected"].includes(connectionState)) {
      await updateChannel(id, auth.session.tenantId, { status: "connected", qrBase64: null, lastError: null });
      await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "qr", sourceId: id });
      return Response.json({ ok: true, type: "connected", status: "connected", instanceId: id, message: "الجهاز متصل بالفعل." });
    }

    qr = await evolutionConnect(channel.instanceName, undefined, 15_000);
    connectionState = qr?.instance?.state || qr?.state || connectionState;
    if (["open", "connected"].includes(connectionState)) {
      await updateChannel(id, auth.session.tenantId, { status: "connected", qrBase64: null, lastError: null });
      await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "qr", sourceId: id });
      return Response.json({ ok: true, type: "connected", status: "connected", instanceId: id, message: "الجهاز متصل بالفعل." });
    }
    const qrBase64 = normalizeEvolutionQr(qr?.base64 || qr?.qrcode?.base64);
    if (!qrBase64) {
      const message = "Evolution API did not return a valid QR image";
      await updateChannel(id, auth.session.tenantId, { status: "error", qrBase64: null, lastError: message });
      await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.qr_failed", title: "WhatsApp QR generation failed" });
      await recordOperationalIssue({
        tenantId: auth.session.tenantId,
        category: "qr",
        source: "evolution",
        sourceId: id,
        message,
        suggestedSolution: "Retry QR generation with the same instance.",
        metadata: {
          operation: "qr_generation",
          instanceNameMasked: maskedInstanceName(channel.instanceName),
          httpStatus: 200,
          responseKeys: Object.keys(qr || {}).slice(0, 20),
          hasBase64: Boolean(qr?.base64 || qr?.qrcode?.base64),
          hasPairingCode: Boolean(qr?.pairingCode || qr?.pairing_code),
          hasCode: Boolean(qr?.code),
          connectionState,
          durationMs: Date.now() - startedAt,
          errorMessage: message
        }
      });
      return Response.json({ ok: false, code: "QR_NOT_RETURNED", message: "لم يرجع Evolution باركود صالح لهذه المحاولة." }, { status: 502 });
    }
    await updateChannel(id, auth.session.tenantId, { status: "pending_qr", qrBase64, lastQrGeneratedAt: new Date(), lastError: null });
    await resolveOperationalIssues({ tenantId: auth.session.tenantId, category: "qr", sourceId: id });
    return Response.json({ ok: true, type: "qr", instanceId: id, qrDataUri: qrBase64, qrBase64, pairingCode: qr?.pairingCode || null, expiresIn: 60 });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    const timeout = isEvolutionTimeout(error);
    const unreachable = isEvolutionUnreachable(error);
    console.error("evolution QR failed", errorMessage);
    await updateChannel(id, auth.session.tenantId, { status: "error", qrBase64: null, lastError: errorMessage });
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.qr_failed", title: "WhatsApp QR generation failed" }).catch(() => null);
    await recordOperationalIssue({
      tenantId: auth.session.tenantId,
      category: "qr",
      source: "evolution",
      sourceId: id,
      message: errorMessage,
      suggestedSolution: "Check Evolution API connectivity and retry QR generation with the same instance.",
      metadata: {
        operation: "qr_generation",
        instanceNameMasked: maskedInstanceName(channel.instanceName),
        httpStatus: Number(errorMessage.match(/Evolution API (\d{3}):/)?.[1] || 0) || null,
        responseKeys: Object.keys(qr || {}).slice(0, 20),
        hasBase64: Boolean(qr?.base64 || qr?.qrcode?.base64),
        hasPairingCode: Boolean(qr?.pairingCode || qr?.pairing_code),
        hasCode: Boolean(qr?.code),
        connectionState,
        durationMs: Date.now() - startedAt,
        errorMessage
      }
    }).catch(() => null);
    const code = timeout ? "EVOLUTION_TIMEOUT" : unreachable ? "EVOLUTION_UNREACHABLE" : "QR_GENERATION_FAILED";
    const message = timeout
      ? "استغرق Evolution وقتًا أطول من المتوقع. حاول مرة أخرى."
      : unreachable
        ? "تعذر الوصول إلى خدمة Evolution حاليًا. تحقق من تشغيل الخادم ثم حاول مرة أخرى."
        : "تعذر إنشاء الباركود من Evolution API. يرجى المحاولة مرة أخرى.";
    return Response.json({ ok: false, code, message }, { status: timeout ? 504 : unreachable ? 503 : 502 });
  }
}
