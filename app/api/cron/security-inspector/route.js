import { validateCronRequest } from "../../_lib/cron.js";
import { expireSecurityData, processSecurityAlerts } from "../../../../src/server/security-center.js";
import { runSecurityInspector } from "../../../../src/server/security-inspector.js";
import { safeErrorMessage } from "../../../../src/server/security.js";

export async function GET(request) {
  const validation = validateCronRequest(request);
  if (!validation.ok) return Response.json({ ok: false, error: validation.error }, { status: validation.status });
  try {
    const [inspector, alerts, retention] = await Promise.all([
      runSecurityInspector({ triggerType: "scheduled" }), processSecurityAlerts(), expireSecurityData()
    ]);
    return Response.json({ ok: true, inspector, alerts, retention });
  } catch (error) {
    console.error("security inspector cron failed", safeErrorMessage(error));
    return Response.json({ ok: false, reason: "security_inspector_failed" }, { status: 500 });
  }
}
