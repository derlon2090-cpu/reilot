import { validateCronRequest } from "../../_lib/cron.js";
import { query } from "../../../../src/server/db.js";
import { calculateSecurityScore } from "../../../../src/server/security-score.js";
import { safeErrorMessage } from "../../../../src/server/security.js";

export async function GET(request) {
  const validation = validateCronRequest(request);
  if (!validation.ok) return Response.json({ ok: false, error: validation.error }, { status: validation.status });
  const users = await query(
    `SELECT DISTINCT ON (tenant_id) id AS "userId", tenant_id AS "tenantId"
       FROM users WHERE tenant_id IS NOT NULL ORDER BY tenant_id, created_at`
  );
  let calculated = 0;
  let failed = 0;
  for (const user of users.rows) {
    try {
      await calculateSecurityScore({ ...user, secureSession: true, persist: true });
      calculated += 1;
    } catch (error) {
      failed += 1;
      console.error("security score cron failed", user.tenantId, safeErrorMessage(error));
    }
  }
  return Response.json({ ok: failed === 0, calculated, failed });
}
