import { runCron } from "../../_lib/cron";

export async function GET(req) {
  return runCron(req, "usage-reset", {
    action: "Ensure each tenant has a subscription-period message quota record and reset notification.",
    keepsHistory: true
  });
}
