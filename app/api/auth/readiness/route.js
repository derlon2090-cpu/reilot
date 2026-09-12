import { isRenderAuthRuntime } from "../../../../src/server/auth-backend-runtime.js";
import { databaseHealth } from "../../../../src/server/db.js";

export async function GET() {
  if (!isRenderAuthRuntime()) {
    return Response.json(
      { ok: false, service: "renvix-auth", reason: "auth_backend_required" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  try {
    const database = await databaseHealth();
    return Response.json(
      { ok: true, service: "renvix-auth", database: "connected", latencyMs: database.latencyMs },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("auth readiness database check failed", { code: String(error?.code || "DATABASE_ERROR") });
    return Response.json(
      { ok: false, service: "renvix-auth", reason: "database_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3" } }
    );
  }
}
