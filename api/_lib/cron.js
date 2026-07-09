export function validateCronRequest(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!cronSecret) {
    return { ok: false, status: 500, error: "CRON_SECRET is missing" };
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return { ok: false, status: 401, error: "Unauthorized cron request" };
  }

  return { ok: true };
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function methodGuard(req, res) {
  if (req.method !== "GET") {
    json(res, 405, { ok: false, error: "Method not allowed" });
    return false;
  }

  return true;
}

export function runCron(req, res, jobName, summary) {
  if (!methodGuard(req, res)) return;

  const validation = validateCronRequest(req);
  if (!validation.ok) {
    json(res, validation.status, { ok: false, job: jobName, error: validation.error });
    return;
  }

  json(res, 200, {
    ok: true,
    job: jobName,
    mode: "scaffold",
    summary,
    nextStep: "Connect Neon + Drizzle repository methods before enabling production sending."
  });
}
