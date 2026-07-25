import { validateCronRequest } from "../../_lib/cron.js";
import { runAdminTemplateEventWorker } from "../../../../src/server/admin-template-events.js";
import { safeErrorMessage } from "../../../../src/server/security.js";

export async function GET(request) {
  const validation = validateCronRequest(request);
  if (!validation.ok) {
    return Response.json({ ok: false, error: validation.error }, { status: validation.status });
  }
  try {
    return Response.json({ ok: true, result: await runAdminTemplateEventWorker() });
  } catch (error) {
    console.error("admin template event worker failed", safeErrorMessage(error));
    return Response.json({ ok: false, error: "Admin template event worker failed" }, { status: 500 });
  }
}
