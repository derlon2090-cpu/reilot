import { after } from "next/server";
import { verifySallaWebhook } from "../../../../../src/lib/salla.js";
import { processProvisioningJobIds, queueSallaProvisioningJobs } from "../../../../../src/server/salla-provisioning.js";

export async function POST(req) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-salla-signature") || req.headers.get("x-salla-hmac-sha256") || "";
  if (!verifySallaWebhook(rawBody, signature)) return Response.json({ ok: false }, { status: 401 });
  let payload;
  try { payload = JSON.parse(rawBody); } catch { return Response.json({ ok: false, message: "Invalid JSON payload" }, { status: 400 }); }

  const metadata = {
    storeId: req.headers.get("x-salla-store-id"),
    eventType: req.headers.get("x-salla-event"),
    eventId: req.headers.get("x-salla-event-id")
  };
  const jobs = await queueSallaProvisioningJobs(payload, metadata);
  if (!jobs.ok && jobs.reason === "missing_order_identity") {
    return Response.json({ ok: false, message: "Missing store or order identifier" }, { status: 400 });
  }
  if (!jobs.duplicate && jobs.ids?.length) {
    after(async () => {
      await processProvisioningJobIds(jobs.ids);
    });
  }
  return Response.json({ ok: true, queued: Boolean(jobs.queued), duplicate: Boolean(jobs.duplicate), jobCount: jobs.ids?.length || 0, ignored: jobs.ignored }, { status: 200 });
}
