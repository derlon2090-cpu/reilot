import { GET as generateQr } from "../instances/[id]/qr/route.js";
import { requireSession } from "../../../../src/server/session.js";
import { latestTenantChannel } from "../../../../src/server/whatsapp-repository.js";

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const channel = await latestTenantChannel(auth.session.tenantId);
  if (!channel) {
    return Response.json({ ok: false, code: "WHATSAPP_CHANNEL_REQUIRED", message: "أنشئ قناة واتساب أولًا قبل طلب الباركود." }, { status: 409 });
  }
  return generateQr(req, { params: Promise.resolve({ id: channel.id }) });
}
