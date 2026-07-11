import { parseSpreadsheetText, previewSubscriptionImport } from "../../../../src/lib/subscriptionImport.js";
import { requireSession } from "../../../../src/server/session.js";

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const rows = Array.isArray(body.rows) ? body.rows : parseSpreadsheetText(body.text);
  return Response.json({ ok: true, preview: previewSubscriptionImport(rows) });
}
