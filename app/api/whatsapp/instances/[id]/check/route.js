import {
  evolutionConnectionState,
  evolutionInstanceDetails,
  evolutionSetWebhook,
  isEvolutionAuthFailed,
  isEvolutionInstanceMissing,
  isEvolutionTimeout,
  isEvolutionUnreachable
} from "../../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";
import { addWhatsAppActivity, ownedChannel, updateChannel } from "../../../../../../src/server/whatsapp-repository.js";

function stateFrom(body) {
  return body?.instance?.state || body?.state || body?.data?.instance?.state || "disconnected";
}

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel) return Response.json({ ok: false, code: "WHATSAPP_CHANNEL_NOT_FOUND", message: "قناة واتساب غير موجودة." }, { status: 404 });

  try {
    const result = await evolutionConnectionState(channel.instanceName);
    const providerState = stateFrom(result);
    const status = ["open", "connected"].includes(providerState)
      ? "connected"
      : providerState === "connecting"
        ? "connecting"
        : "disconnected";
    const details = status === "connected" ? await evolutionInstanceDetails(channel.instanceName).catch(() => null) : null;
    const owner = details?.ownerJid || details?.owner || details?.instance?.ownerJid || details?.instance?.owner
      || result?.instance?.owner || result?.instance?.ownerJid || result?.owner || "";
    const phoneNumber = String(owner).split("@")[0].replace(/\D/g, "") || undefined;
    const deviceName = details?.profileName || details?.profile?.name || details?.instance?.profileName
      || result?.instance?.profileName || result?.instance?.name || undefined;
    const updated = await updateChannel(id, auth.session.tenantId, {
      status,
      phoneNumber,
      deviceName,
      qrBase64: status === "connected" ? null : undefined,
      lastError: null
    });
    if (status === "connected") {
      await evolutionSetWebhook(channel.instanceName);
      await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.connected", title: "WhatsApp connected" }).catch(() => null);
    }
    return Response.json({
      ok: true,
      instanceId: id,
      status,
      providerState,
      phoneNumber: updated?.phoneNumber || null,
      deviceName: updated?.deviceName || null,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    if (isEvolutionInstanceMissing(error)) {
      await updateChannel(id, auth.session.tenantId, { status: "disconnected", qrBase64: null, lastError: "Link session not found on the configured server" });
      return Response.json({
        ok: true,
        instanceId: id,
        status: "disconnected",
        providerState: "not_found",
        code: "EVOLUTION_INSTANCE_NOT_FOUND",
        message: "جلسة الربط غير موجودة على الخادم الحالي. أنشئ باركودًا أو رمز اقتران لإعادة ربطها.",
        checkedAt: new Date().toISOString()
      });
    }

    console.error("evolution check failed", errorMessage);
    await updateChannel(id, auth.session.tenantId, { status: "error", lastError: errorMessage });
    const authFailed = isEvolutionAuthFailed(error);
    const timeout = isEvolutionTimeout(error);
    const unreachable = isEvolutionUnreachable(error);
    const code = authFailed ? "EVOLUTION_AUTH_FAILED" : timeout ? "EVOLUTION_TIMEOUT" : unreachable ? "EVOLUTION_UNREACHABLE" : "EVOLUTION_STATUS_FAILED";
    const message = authFailed
      ? "تعذر توثيق الاتصال بخدمة الربط. تحقق من إعدادات الخادم."
      : timeout
        ? "استغرق فحص خدمة الربط وقتًا أطول من المتوقع."
        : unreachable
          ? "تعذر الوصول إلى خدمة الربط حاليًا."
          : "تعذر فحص اتصال واتساب.";
    return Response.json({ ok: false, code, message }, { status: timeout ? 504 : unreachable ? 503 : 502 });
  }
}
