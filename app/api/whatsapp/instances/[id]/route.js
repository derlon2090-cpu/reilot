import { evolutionDelete } from "../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../src/server/security.js";
import { addWhatsAppActivity, deleteChannel, ownedChannel } from "../../../../../src/server/whatsapp-repository.js";

export async function DELETE(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel) return Response.json({ ok: false, message: "Instance not found" }, { status: 404 });
  try {
    await evolutionDelete(channel.instanceName);
    await deleteChannel(id, auth.session.tenantId);
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "evolution.deleted", title: "WhatsApp instance deleted" });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("evolution delete failed", safeErrorMessage(error));
    return Response.json({ ok: false, message: "Unable to delete WhatsApp instance" }, { status: 502 });
  }
}
