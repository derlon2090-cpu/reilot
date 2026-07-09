import { runCron } from "../_lib/cron.js";

export default function handler(req, res) {
  runCron(req, res, "message-retry", {
    action: "Process pending message_queue items with quota, quiet-hours, duplicate, unsubscribe, and risk checks.",
    maxMessagesPerTenantPerRun: 20,
    retrySchedule: ["now", "15 minutes", "1 hour"]
  });
}
