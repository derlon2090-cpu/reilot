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

export function runCron(req, jobName, summary) {
  const validation = validateCronRequest(req);

  if (!validation.ok) {
    return Response.json(
      { ok: false, job: jobName, error: validation.error },
      { status: validation.status }
    );
  }

  return Response.json({
    ok: true,
    job: jobName,
    mode: "scaffold",
    summary,
    nextStep: "Connect Neon + Drizzle repository methods before enabling production sending."
  });
}
