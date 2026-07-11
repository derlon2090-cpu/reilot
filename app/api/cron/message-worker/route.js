import { runCron } from "../../_lib/cron";

export async function GET(req) {
  return runCron(req, "message-worker", {
    action: "Processes pending WhatsApp messages with safety checks and retry backoff.",
    maxMessagesPerRun: 20
  });
}
