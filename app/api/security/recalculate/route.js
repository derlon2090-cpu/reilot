import { calculateSecurityScore } from "../../../../src/server/security-score.js";
import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const recent = await query(
    `SELECT count(*)::int AS total FROM security_score_snapshots
      WHERE tenant_id = $1 AND user_id = $2 AND calculated_at > now() - interval '1 minute'`,
    [auth.session.tenantId, auth.session.userId]
  );
  if (Number(recent.rows[0]?.total || 0) >= 5) return Response.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  const secureSession = request.headers.get("x-forwarded-proto") === "https" || process.env.NODE_ENV === "production";
  return Response.json({ ok: true, ...(await calculateSecurityScore({ ...auth.session, secureSession, persist: true })) });
}
