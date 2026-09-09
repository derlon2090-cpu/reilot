import { validateCronRequest } from "../../_lib/cron.js";
import { reconcileAllMetaTemplates } from "../../../../src/server/meta-template-service.js";
import { safeErrorMessage } from "../../../../src/server/security.js";

export async function GET(request) {
  const validation = validateCronRequest(request);
  if (!validation.ok) return Response.json({ ok: false, error: validation.error }, { status: validation.status });
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: true, mode: "configuration_required", result: { tenants: 0, synchronized: 0, failed: 0 } });
  }
  try {
    const result = await reconcileAllMetaTemplates();
    return Response.json({ ok: result.failed === 0, mode: "live", result }, { status: result.failed ? 207 : 200 });
  } catch (error) {
    console.error("Meta template reconciliation failed", safeErrorMessage(error));
    return Response.json({ ok: false, error: "Meta template reconciliation failed" }, { status: 500 });
  }
}
