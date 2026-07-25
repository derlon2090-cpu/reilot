import crypto from "node:crypto";
import { evolutionLogout } from "../../../../../../src/server/evolution-client.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";
import { ownedChannel } from "../../../../../../src/server/whatsapp-repository.js";
import { transaction } from "../../../../../../src/server/db.js";
import { enqueueAdminDomainEvent } from "../../../../../../src/server/admin-template-events.js";

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const channel = await ownedChannel(id, auth.session.tenantId);
  if (!channel) return Response.json({ ok: false, message: "Instance not found" }, { status: 404 });
  try {
    await evolutionLogout(channel.instanceName);
    const disconnectionEventId = crypto.randomUUID();
    await transaction(async (client) => {
      const changed = await client.query(
        `UPDATE whatsapp_channels SET status='disconnected',qr_code_cache=NULL,
                last_error='تم فصل القناة بطلب من مالك الحساب.',
                disconnected_at=now(),last_disconnect_at=now(),updated_at=now()
          WHERE id=$1 AND tenant_id=$2 RETURNING id`,
        [id, auth.session.tenantId]
      );
      if (!changed.rows[0]) throw new Error("INSTANCE_NOT_FOUND");
      await client.query(
        `INSERT INTO activity_logs (tenant_id,user_id,type,title)
         VALUES ($1,$2,'evolution.disconnected','WhatsApp disconnected')`,
        [auth.session.tenantId, auth.session.userId]
      );
      await enqueueAdminDomainEvent(client, {
        eventType: "channel.disconnected",
        aggregateType: "whatsapp_channel",
        aggregateId: id,
        payloadRefs: { channelId: id, disconnectionEventId, reasonCode: "user_requested" },
        idempotencyKey: `admin-channel-disconnected:${disconnectionEventId}`
      });
    });
    return Response.json({ ok: true, instanceId: id, status: "disconnected" });
  } catch (error) {
    console.error("evolution disconnect failed", safeErrorMessage(error));
    return Response.json({ ok: false, message: "Unable to disconnect WhatsApp" }, { status: 502 });
  }
}
