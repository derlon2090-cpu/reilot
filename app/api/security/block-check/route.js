import crypto from "node:crypto";
import { evaluateSecurityBlockRequest } from "../../../../src/server/security-center.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function verify(rawBody, timestamp, signature) {
  const secret = String(process.env.SECURITY_BLOCK_CHECK_SECRET || "");
  const time = Number(timestamp);
  if (secret.length < 32 || !Number.isFinite(time) || Math.abs(Date.now() - time) > 60_000) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${time}.${rawBody}`).digest("hex");
  const supplied = String(signature || "").replace(/^sha256=/, "");
  return supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export async function POST(request) {
  const rawBody = await request.text();
  if (rawBody.length > 8192 || !verify(rawBody, request.headers.get("x-security-timestamp"), request.headers.get("x-security-signature"))) {
    return Response.json({ ok: false }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  let body;
  try { body = JSON.parse(rawBody || "{}"); } catch { return Response.json({ ok: false }, { status: 400 }); }
  const block = await evaluateSecurityBlockRequest(body);
  return Response.json(
    block ? { ok: true, blocked: true, referenceId: block.referenceId } : { ok: true, blocked: false },
    { headers: { "cache-control": "private, no-store" } }
  );
}
