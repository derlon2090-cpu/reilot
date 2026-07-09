import { runCron } from "../_lib/cron.js";

export default function handler(req, res) {
  runCron(req, res, "usage-reset", {
    action: "Create the new monthly message_usage rows from each tenant platform plan.",
    keepsHistory: true
  });
}
