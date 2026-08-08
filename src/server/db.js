import pg from "pg";

const { Pool } = pg;
let pool;

const TRANSIENT_DATABASE_CODES = new Set([
  "08000", "08001", "08003", "08004", "08006", "08007", "08P01",
  "53300", "57P01", "57P02", "57P03",
  "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EPIPE", "ETIMEDOUT"
]);

export function isTransientDatabaseError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "");
  return TRANSIENT_DATABASE_CODES.has(code)
    || code.startsWith("08")
    || /connection terminated|connection timeout|timeout expired|server closed the connection/i.test(message);
}

export function databaseFailureReason(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "");
  if (code === "42P01" || code === "42703" || code === "42883") return "database_schema_missing";
  if (isTransientDatabaseError(error) || /DATABASE_URL is missing/i.test(message)) return "database_unavailable";
  return "admin_auth_service_unavailable";
}

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is missing");
  return value;
}
export function getPool() {
  if (!pool) {
    const defaultPoolSize = process.env.VERCEL ? 3 : 10;
    pool = new Pool({
      connectionString: databaseUrl(),
      max: Math.max(1, Number(process.env.DATABASE_POOL_SIZE || defaultPoolSize)),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      keepAlive: true,
      allowExitOnIdle: Boolean(process.env.VERCEL),
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
    });
    pool.on("error", (error) => {
      console.error("idle database client error", String(error?.code || "DATABASE_ERROR"));
    });
  }
  return pool;
}

function retryDelay() {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

function isRetryableReadQuery(text) {
  return /^\s*(SELECT|SHOW|EXPLAIN)\b/i.test(String(text || ""));
}

export async function query(text, values = []) {
  try {
    return await getPool().query(text, values);
  } catch (error) {
    // A write may have reached PostgreSQL before the connection dropped. Only
    // retry read-only statements so a transient outage can never duplicate a
    // mutation such as an audit record, session, or rate-limit increment.
    if (!isTransientDatabaseError(error) || !isRetryableReadQuery(text)) throw error;
    await retryDelay();
    return getPool().query(text, values);
  }
}

export async function transaction(callback) {
  let client;
  try {
    client = await getPool().connect();
  } catch (error) {
    if (!isTransientDatabaseError(error)) throw error;
    await retryDelay();
    client = await getPool().connect();
  }
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseHealth() {
  const startedAt = Date.now();
  await query("SELECT 1 AS ok");
  return { ok: true, latencyMs: Date.now() - startedAt };
}
