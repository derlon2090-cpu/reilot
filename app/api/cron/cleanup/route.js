import { runCron } from "../../_lib/cron";

export async function GET(req) {
  return runCron(req, "cleanup", {
    action: "Clear stale QR cache, expired sessions, old temporary records, and storage trash retained for 15 days.",
    destructiveDeletes: true
  });
}
