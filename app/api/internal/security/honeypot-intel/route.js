import crypto from "node:crypto";
import { query } from "../../../../../src/server/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request) {
  const expected = String(process.env.HONEYPOT_INTEL_EXPORT_TOKEN || "");
  const supplied = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function decodeCursor(value) {
  if (!value) return { seenAt: "1970-01-01T00:00:00.000Z", eventId: "00000000-0000-0000-0000-000000000000" };
  try {
    const [seenAt, eventId] = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (!Number.isFinite(Date.parse(seenAt)) || !/^[a-f0-9-]{36}$/i.test(eventId)) throw new Error("invalid cursor");
    return { seenAt: new Date(seenAt).toISOString(), eventId };
  } catch {
    return null;
  }
}

function encodeCursor(row) {
  return Buffer.from(JSON.stringify([new Date(row.seenAt).toISOString(), row.eventId])).toString("base64url");
}

export async function GET(request) {
  const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
  if (!authorized(request)) return Response.json({ ok: false, reason: "not_found" }, { status: 404, headers });
  const cursor = decodeCursor(new URL(request.url).searchParams.get("after"));
  if (!cursor) return Response.json({ ok: false, reason: "invalid_cursor" }, { status: 400, headers });
  const result = await query(
    `SELECT event_id::text AS "eventId",requested_path AS path,last_seen AS "seenAt"
       FROM security_source_events
      WHERE event_type='ADMIN_HONEYPOT_ACCESS'
        AND requested_path IS NOT NULL
        AND (last_seen>$1::timestamptz OR (last_seen=$1::timestamptz AND event_id::text>$2))
      ORDER BY last_seen,event_id::text LIMIT 500`,
    [cursor.seenAt, cursor.eventId]
  );
  const events = result.rows.map((row) => ({
    id: row.eventId,
    path: String(row.path || "").slice(0, 300),
    seenAt: new Date(row.seenAt).toISOString()
  }));
  return Response.json({
    ok: true,
    events,
    nextCursor: events.length ? encodeCursor(events.at(-1)) : new URL(request.url).searchParams.get("after") || ""
  }, { headers });
}
