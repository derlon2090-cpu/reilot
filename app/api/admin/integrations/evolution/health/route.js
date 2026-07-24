import { adminEvolutionHealth } from "../../../../../../src/server/admin-evolution-provider.js";
import { auditAdmin, requireAdminPermission } from "../../../../../../src/server/admin-auth.js";
import { query } from "../../../../../../src/server/db.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const auth = await requireAdminPermission(request, "integrations", "update");
  if (!auth.ok) return auth.response;
  let result;
  try {
    const health = await adminEvolutionHealth();
    result = { status: "healthy", responseTimeMs: health.responseTimeMs, lastError: null };
  } catch (error) {
    result = {
      status: error?.code === "EVOLUTION_ADMIN_NOT_CONFIGURED" ? "not_configured" : "error",
      responseTimeMs: null,
      lastError: safeErrorMessage(error).slice(0, 500)
    };
  }
  await query(
    `INSERT INTO platform_integration_health(provider,status,response_time_ms,last_checked_at,last_error_safe,error_count,updated_at)
     VALUES ('evolution_admin',$1,$2,now(),$3,CASE WHEN $1='healthy' THEN 0 ELSE 1 END,now())
     ON CONFLICT (provider) DO UPDATE SET status=excluded.status,response_time_ms=excluded.response_time_ms,
       last_checked_at=excluded.last_checked_at,last_error_safe=excluded.last_error_safe,
       error_count=CASE WHEN excluded.status='healthy' THEN 0 ELSE platform_integration_health.error_count+1 END,updated_at=now()`,
    [result.status, result.responseTimeMs, result.lastError]
  );
  await auditAdmin(request, { admin: auth.admin, action: "admin.integration.health_check", resource: "evolution_admin", status: result.status === "healthy" ? "success" : "failed", metadata: { status: result.status } });
  return Response.json({ ok: result.status === "healthy", provider: "evolution_admin", ...result }, { status: result.status === "healthy" ? 200 : 503 });
}
