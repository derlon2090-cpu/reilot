import crypto from "node:crypto";
import { query } from "../../../../src/server/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_HASH = "28a77d074ef415e6ddd0d05e2ceb9d0feb3fd09843ea9406b3e0ceffe34a9499";

function authorized(request) {
  if (process.env.NODE_ENV !== "production" || new URL(request.url).hostname !== "renvix.app") return false;
  const token = String(request.headers.get("x-renvix-diagnostic-token") || "");
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const actual = crypto.createHash("sha256").update(token).digest();
  const expected = Buffer.from(TOKEN_HASH, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function reply(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive"
    }
  });
}

export async function POST(request) {
  if (!authorized(request)) return reply({ ok: false }, 404);
  try {
    const [events, blocks, migrations] = await Promise.all([
      query(`
        SELECT
          count(*) FILTER (WHERE last_seen > now() - interval '20 minutes')::int AS recent_events,
          count(*) FILTER (
            WHERE last_seen > now() - interval '20 minutes'
              AND COALESCE(metadata->>'honeypotDeviceId','') <> ''
          )::int AS events_with_device_id,
          count(*) FILTER (
            WHERE last_seen > now() - interval '20 minutes'
              AND metadata->>'automaticDeviceContainment' = 'true'
          )::int AS automatic_containment_requests
        FROM security_source_events
        WHERE event_type = 'ADMIN_HONEYPOT_ACCESS'
      `),
      query(`
        SELECT count(*)::int AS active_device_blocks
        FROM security_blocks
        WHERE target_type = 'device' AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
          AND created_at > now() - interval '20 minutes'
      `),
      query(`
        SELECT
          bool_and(checksum IS NOT NULL) AS checksums_ready,
          count(*) FILTER (WHERE name IN (
            '0091_security_operations_center.sql',
            '0092_honeypot_first_alerts.sql',
            '0093_security_notifications_and_blocks.sql',
            '0094_storage_center_insights.sql'
          ))::int AS security_migrations
        FROM schema_migrations
      `)
    ]);
    return reply({
      ok: true,
      config: {
        ingestionSecret: String(process.env.HONEYPOT_INGESTION_SECRET || "").length >= 32,
        blockPepper: String(process.env.SECURITY_BLOCK_PEPPER || "").length >= 32,
        boundarySecret: String(process.env.SECURITY_BLOCK_CHECK_SECRET || "").length >= 32
      },
      events: events.rows[0],
      blocks: blocks.rows[0],
      migrations: migrations.rows[0]
    });
  } catch (error) {
    return reply({ ok: false, code: String(error?.code || "DIAGNOSTIC_FAILED").slice(0, 80) }, 500);
  }
}

export function GET() {
  return reply({ ok: false }, 404);
}
