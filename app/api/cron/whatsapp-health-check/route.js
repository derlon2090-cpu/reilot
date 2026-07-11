import { runCron } from "../../_lib/cron";

export async function GET(req) {
  return runCron(req, "whatsapp-health-check", {
    action: "Check connected Evolution instances in batches and update instance health.",
    batchSize: 50
  });
}
