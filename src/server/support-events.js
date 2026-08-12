export const SUPPORT_EVENT_CHANNEL = "renvix_support_events";

function supportEventPayload(payload = {}) {
  return JSON.stringify({
    kind: String(payload.kind || "ticket-updated"),
    ticketId: String(payload.ticketId || ""),
    tenantId: payload.tenantId ? String(payload.tenantId) : null,
    userId: payload.userId ? String(payload.userId) : null,
    status: payload.status ? String(payload.status) : null,
    internal: Boolean(payload.internal),
    sentAt: new Date().toISOString()
  });
}

export async function publishSupportChange(client, payload) {
  await client.query("SELECT pg_notify($1,$2)", [SUPPORT_EVENT_CHANNEL, supportEventPayload(payload)]);
}
