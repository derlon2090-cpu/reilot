import process from "node:process";
import { runCronJob } from "../src/server/cron-runner.js";

const job = process.argv[2];
const allowed = new Set([
  "renewal-reminders",
  "whatsapp-health-check",
  "message-retry",
  "message-worker",
  "usage-reset",
  "cleanup"
]);

if (!allowed.has(job)) {
  console.error(`Unknown cron job: ${job || "(missing)"}`);
  process.exit(2);
}

const result = await runCronJob(job);
console.log(JSON.stringify({ ok: true, job, result }));
