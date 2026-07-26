import crypto from "node:crypto";
import { applyMetaMessagesWebhook } from "../../../../src/server/meta-interactive-service.js";
import { applyMetaTemplateStatus } from "../../../../src/server/meta-template-service.js";

function validSignature(rawBody, signature) {
  const secret = process.env.META_WEBHOOK_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const supplied = signature.slice(7);
  if (supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export async function GET(request) {
  const url = new URL(request.url);
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (expected && mode === "subscribe" && token === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const payload = JSON.parse(raw);
  let processed = 0;
  for (const entry of Array.isArray(payload.entry) ? payload.entry : []) {
    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      const value = change.value || {};
      if (change.field === "message_template_status_update") {
        const result = await applyMetaTemplateStatus({
          wabaId: String(entry.id || value.waba_id || ""),
          templateId: value.message_template_id || value.id || null,
          name: value.message_template_name || value.name || "",
          language: value.message_template_language || value.language || "",
          status: value.event || value.status || "",
          category: value.category || null,
          reason: value.reason || value.rejection_reason || null,
          qualityRating: value.quality_score || value.quality_rating || null
        });
        if (result.changed) processed += 1;
      }
      if (change.field === "messages") {
        const result = await applyMetaMessagesWebhook({
          wabaId: String(entry.id || value.waba_id || ""),
          phoneNumberId: value.metadata?.phone_number_id || "",
          value
        });
        processed += result.processed;
      }
    }
  }
  return Response.json({ ok: true, processed });
}
