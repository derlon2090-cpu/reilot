import { isRenderAuthRuntime } from "../../../../src/server/auth-backend-runtime.js";

export async function GET() {
  if (!isRenderAuthRuntime()) {
    return Response.json(
      { ok: false, service: "renvix-auth", reason: "auth_backend_required" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  return Response.json(
    { ok: true, service: "renvix-auth" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
