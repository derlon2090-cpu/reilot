import { validateCronRequest } from "../../_lib/cron.js";
import { runSallaWebhookWorker } from "../../../../src/server/salla-app.js";

export async function GET(req) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  return Response.json({ ok: true, ...(await runSallaWebhookWorker()) });
}

export const POST = GET;
