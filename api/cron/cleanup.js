import { runCron } from "../_lib/cron.js";

export default function handler(req, res) {
  runCron(req, res, "cleanup", {
    action: "Clear stale QR cache, expired sessions, and old temporary queue records.",
    destructiveDeletes: false
  });
}
