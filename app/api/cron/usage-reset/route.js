import { runCron } from "../../_lib/cron";

export function GET(req) {
  return runCron(req, "usage-reset", {
    action: "Create the new monthly message_usage rows from each tenant platform plan.",
    keepsHistory: true
  });
}
