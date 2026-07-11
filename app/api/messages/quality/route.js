import { evaluateMessageQuality } from "../../../../src/lib/messageSafety.js";
import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const result = evaluateMessageQuality(body.message);
  const blocked = result.score === "risk";
  await query(
    `INSERT INTO message_quality_checks (tenant_id, user_id, score, risk, warnings, blocked)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [auth.session.tenantId, auth.session.userId, result.score, result.risk, JSON.stringify(result.warnings), blocked]
  );
  return Response.json({ ok: !blocked, blocked, ...result }, { status: blocked ? 422 : 200 });
}
