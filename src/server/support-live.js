import { query } from "./db.js";

const encoder = new TextEncoder();

function eventChunk(event, data) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function userSupportVersion(session) {
  const result = await query(
    `SELECT CONCAT_WS(':',
       count(*)::text,
       COALESCE(max(t.updated_at)::text,''),
       COALESCE(sum(t.user_unread_count),0)::text,
       COALESCE((
         SELECT max(m.created_at)::text
         FROM support_ticket_messages m
         JOIN support_tickets owned ON owned.id=m.ticket_id
         WHERE owned.tenant_id=$1 AND owned.created_by_user_id=$2 AND NOT m.is_internal_note
       ),'')
     ) AS version
     FROM support_tickets t
     WHERE t.tenant_id=$1 AND t.created_by_user_id=$2`,
    [session.tenantId, session.userId]
  );
  return String(result.rows[0]?.version || "0");
}

export async function adminSupportVersion() {
  const result = await query(
    `SELECT CONCAT_WS(':',
       count(*)::text,
       COALESCE(max(t.updated_at)::text,''),
       COALESCE(sum(t.admin_unread_count),0)::text,
       COALESCE((SELECT max(created_at)::text FROM support_ticket_messages),'')
     ) AS version
     FROM support_tickets t`
  );
  return String(result.rows[0]?.version || "0");
}

export function createSupportEventStream(request, getVersion, options = {}) {
  const pollMs = Math.max(250, Number(options.pollMs || 1_500));
  const heartbeatMs = Math.max(1_000, Number(options.heartbeatMs || 15_000));
  let timer = null;
  let controllerRef = null;
  let closed = false;
  let lastVersion = null;
  let lastHeartbeat = 0;

  const enqueue = (chunk) => {
    if (closed || !controllerRef) return;
    try { controllerRef.enqueue(chunk); } catch { closed = true; }
  };
  const close = () => {
    if (closed) return;
    closed = true;
    if (timer) clearTimeout(timer);
    try { controllerRef?.close(); } catch {}
  };

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      enqueue(encoder.encode("retry: 1500\n\n"));
      request.signal?.addEventListener("abort", close, { once: true });

      const tick = async () => {
        if (closed) return;
        try {
          const version = String(await getVersion());
          const now = Date.now();
          if (lastVersion === null) {
            lastVersion = version;
            lastHeartbeat = now;
            enqueue(eventChunk("support-ready", { version }));
          } else if (version !== lastVersion) {
            lastVersion = version;
            lastHeartbeat = now;
            enqueue(eventChunk("support-change", { version }));
          } else if (now - lastHeartbeat >= heartbeatMs) {
            lastHeartbeat = now;
            enqueue(encoder.encode(": keep-alive\n\n"));
          }
        } catch {
          close();
          return;
        }
        if (!closed) timer = setTimeout(tick, pollMs);
      };
      void tick();
    },
    cancel() {
      closed = true;
      if (timer) clearTimeout(timer);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Vary": "Cookie",
      "X-Accel-Buffering": "no"
    }
  });
}
