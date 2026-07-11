import { runCronJob } from "../../../src/server/cron-runner.js";
import { safeErrorMessage } from "../../../src/server/security.js";

export function validateCronRequest(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret) {
    return { ok: false, status: 500, error: "CRON_SECRET is missing" };
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return { ok: false, status: 401, error: "Unauthorized cron request" };
  }

  return { ok: true };
}

export async function runCron(req, jobName, summary) {
  const validation = validateCronRequest(req);

  if (!validation.ok) {
    return Response.json(
      { ok: false, job: jobName, error: validation.error },
      { status: validation.status }
    );
  }

  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: true, job: jobName, mode: "configuration_required", summary });
  }

  try {
    const result = await runCronJob(jobName);
    return Response.json({ ok: true, job: jobName, mode: "live", result });
  } catch (error) {
    console.error(`cron ${jobName} failed`, safeErrorMessage(error));
    return Response.json({ ok: false, job: jobName, error: "Cron execution failed" }, { status: 500 });
  }
}
