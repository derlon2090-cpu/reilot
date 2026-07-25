import { validateCronRequest } from "../../_lib/cron.js";
import { runPlatformNotificationWorker } from "../../../../src/server/platform-notifications.js";
import { safeErrorMessage } from "../../../../src/server/security.js";

export async function GET(request) {
  const validation = validateCronRequest(request);
  if (!validation.ok) return Response.json({ ok: false, error: validation.error }, { status: validation.status });
  try {
    return Response.json({ ok: true, result: await runPlatformNotificationWorker() });
  } catch (error) {
    console.error("platform notification worker failed", safeErrorMessage(error));
    return Response.json({ ok: false, error: "Platform notification worker failed" }, { status: 500 });
  }
}
