import crypto from "node:crypto";
import path from "node:path";
import pg from "pg";
import { loadMigrationFiles, runMigrationPlan } from "../../../../scripts/lib/migration-runner.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const AUTHORIZED_HOST = "renvix.app";
const RELEASE_ID = "breakglass-98c1c511";
const TOKEN_HASH = "0236debc9645705a78d37e2d1234369ba0df37f8265452665184a67b35ba93c5";

function isAuthorized(request) {
  const token = String(request.headers.get("x-renvix-migration-token") || "");
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const actual = crypto.createHash("sha256").update(token).digest();
  const expected = Buffer.from(TOKEN_HASH, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function json(body, status) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive"
    }
  });
}

export async function POST(request) {
  if (process.env.NODE_ENV !== "production"
    || new URL(request.url).hostname.toLowerCase() !== AUTHORIZED_HOST
    || !isAuthorized(request)) {
    return json({ ok: false, code: "NOT_FOUND" }, 404);
  }
  if (!process.env.DATABASE_URL) return json({ ok: false, code: "DATABASE_UNAVAILABLE" }, 503);

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
  });
  try {
    const migrations = await loadMigrationFiles(path.join(process.cwd(), "drizzle"));
    await client.connect();
    const migration = await runMigrationPlan(client, {
      migrations,
      lockTimeoutMs: 60_000,
      logger: {
        log: (message) => console.log(String(message).slice(0, 180)),
        error: (_message, detail) => console.error("MIGRATION_LOCK_RELEASE_FAILED", {
          code: String(detail?.code || "MIGRATION_LOCK_RELEASE_FAILED").slice(0, 80)
        })
      }
    });
    const verification = (await client.query(`
      SELECT
        to_regclass('public.auth_email_otp_challenges') IS NOT NULL AS auth_email_otp_ready,
        to_regclass('public.auth_mfa_login_challenges') IS NOT NULL AS auth_mfa_ready,
        to_regclass('public.platform_admin_auth_challenges') IS NOT NULL AS admin_challenges_ready,
        to_regclass('public.security_source_events') IS NOT NULL AS security_events_ready,
        to_regclass('public.security_incidents') IS NOT NULL AS security_incidents_ready,
        to_regclass('public.security_blocks') IS NOT NULL AS security_blocks_ready
    `)).rows[0] || {};
    if (Object.values(verification).some((ready) => ready !== true)) {
      return json({ ok: false, code: "SCHEMA_VERIFICATION_FAILED", releaseId: RELEASE_ID }, 500);
    }
    return json({
      ok: true,
      releaseId: RELEASE_ID,
      applied: migration.applied,
      skipped: migration.skipped,
      verified: migration.verified === true,
      authSchemaReady: true,
      securitySchemaReady: true
    }, 200);
  } catch (error) {
    console.error("PRODUCTION_MIGRATION_BREAKGLASS_FAILED", {
      code: String(error?.code || "MIGRATION_FAILED").slice(0, 80),
      releaseId: RELEASE_ID
    });
    return json({ ok: false, code: String(error?.code || "MIGRATION_FAILED").slice(0, 80), releaseId: RELEASE_ID }, 500);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export function GET() {
  return json({ ok: false, code: "NOT_FOUND" }, 404);
}
