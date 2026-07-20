import { calculateSecurityScore } from "../../../../src/server/security-score.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const score = await calculateSecurityScore({ ...auth.session, secureSession: process.env.NODE_ENV === "production" });
  return Response.json({ ok: true, recommendations: score.recommendations, criticalIssues: score.criticalIssues, calculatedAt: score.calculatedAt });
}
