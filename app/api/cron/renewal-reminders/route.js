import { runCron } from "../../_lib/cron";

export function GET(req) {
  return runCron(req, "renewal-reminders", {
    action: "Queue renewal reminder messages for active automation rules.",
    windows: [7, 3, 1, 0, -1, -3],
    sendsDirectly: false
  });
}
