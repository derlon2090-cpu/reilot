import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest, updatePlatformNotificationRecipient } from "../../../../../src/server/platform-notifications.js";

export async function POST(request, { params }) {
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const { recipientId } = await params;
  const result = await updatePlatformNotificationRecipient({ recipientId, userId: auth.session.userId, event: "acknowledge" });
  return result ? Response.json(result) : Response.json({ ok: false, reason: "notification_not_found" }, { status: 404 });
}
