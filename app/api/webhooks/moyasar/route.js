import { processMoyasarWebhook } from "../../../../src/server/moyasar-billing.js";

export async function POST(request) {
  const payload = await request.json().catch(() => null);
  if (!payload) return Response.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  try {
    const result = await processMoyasarWebhook(payload);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      { ok: false, reason: error.code || "webhook_failed" },
      { status: Number(error.status || 500) }
    );
  }
}
