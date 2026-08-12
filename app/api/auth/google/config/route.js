import crypto from "node:crypto";
import { authCorsHeaders, authCorsPreflight, authOriginAllowed } from "../../../../../src/server/auth-cors.js";
import { authBackendUnavailableResponse, isRenderAuthRuntime } from "../../../../../src/server/auth-backend-runtime.js";
import { googleClientId } from "../../../../../src/server/google-auth.js";

function fingerprint(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function GET(req) {
  if (!isRenderAuthRuntime()) return authBackendUnavailableResponse();
  if (!authOriginAllowed(req)) return Response.json({ ok: false, reason: "origin_not_allowed" }, { status: 403 });
  const clientId = googleClientId();
  if (!clientId) return Response.json({ ok: false, reason: "google_not_configured" }, { status: 503 });
  return Response.json(
    { ok: true, clientIdFingerprint: fingerprint(clientId) },
    { headers: { ...authCorsHeaders(req), "Cache-Control": "no-store" } }
  );
}

export async function OPTIONS(req) {
  return authCorsPreflight(req, "GET, OPTIONS");
}
