import { runCron } from "../../_lib/cron";

export async function GET(req) {
  return runCron(req, "cleanup", {
    action: "Clear stale QR cache, expired sessions, and old temporary queue records.",
    destructiveDeletes: false
  });
}
