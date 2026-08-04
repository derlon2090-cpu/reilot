import { requireSession } from "./session.js";

export async function evolutionUnavailableToUsers(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  return Response.json(
    { ok: false, reason: "official_meta_only", message: "هذه الوظيفة إدارية ولا تتوفر لحسابات المتاجر." },
    { status: 404, headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
