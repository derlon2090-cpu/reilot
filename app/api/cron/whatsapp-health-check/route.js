import { runCron } from "../../_lib/cron";

export function GET(req) {
  return runCron(req, "whatsapp-health-check", {
    action: "Check connected WhatsApp channels in batches and update channel health.",
    batchSize: 50
  });
}
