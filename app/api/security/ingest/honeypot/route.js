import { ingestHoneypotEvent, verifySignedIngestion } from "../../../../../src/server/security-center.js";
import { safeErrorMessage } from "../../../../../src/server/security.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_384) return Response.json({ ok: false, reason: "payload_too_large" }, { status: 413 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 16_384) return Response.json({ ok: false, reason: "payload_too_large" }, { status: 413 });
  const timestamp = request.headers.get("x-renvix-timestamp");
  const signature = request.headers.get("x-renvix-signature");
  if (!verifySignedIngestion({ rawBody, timestamp, signature })) {
    return Response.json({ ok: false, reason: "invalid_signature" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  try {
    const body = JSON.parse(rawBody);
    const outcome = await ingestHoneypotEvent(body);
    return Response.json(outcome, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  } catch (error) {
    console.error("honeypot ingestion failed", safeErrorMessage(error));
    return Response.json({ ok: false, reason: "ingestion_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
