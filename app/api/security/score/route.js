import { calculateSecurityScore } from "../../../../src/server/security-score.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const secureSession = request.headers.get("x-forwarded-proto") === "https" || process.env.NODE_ENV === "production";
  return Response.json({ ok: true, ...(await calculateSecurityScore({ ...auth.session, secureSession })) });
}
