import { after } from "next/server";
import { verifySallaWebhook } from "../../../../src/lib/salla.js";
import { queueSallaWebhookEvent, runSallaWebhookWorker } from "../../../../src/server/salla-app.js";

export async function POST(req) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-salla-signature") || req.headers.get("x-salla-hmac-sha256") || "";
  if (!verifySallaWebhook(rawBody, signature)) return Response.json({ ok: false }, { status: 401 });
  const payload = (() => { try { return JSON.parse(rawBody); } catch { return null; } })();
  if (!payload) return Response.json({ ok: false, message: "Invalid JSON payload" }, { status: 400 });
  try {
    const result = await queueSallaWebhookEvent(payload);
    if (result.queued) {
      after(async () => {
        try {
          await runSallaWebhookWorker();
        } catch (error) {
          console.error("Salla after-response worker failed", error);
        }
      });
    }
    return Response.json(result, { status: 200 });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
