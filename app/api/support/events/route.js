import { requireSession } from "../../../../src/server/session.js";
import { createSupportEventStream, userSupportVersion } from "../../../../src/server/support-live.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  return createSupportEventStream(request, () => userSupportVersion(auth.session));
}
