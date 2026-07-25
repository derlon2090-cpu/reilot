import { z } from "zod";
import { requireAdminPermission } from "../../../../../src/server/admin-auth.js";
import { estimatePlatformNotificationAudience, sameOriginRequest } from "../../../../../src/server/platform-notifications.js";

const schema = z.object({
  audienceType: z.enum(["all_users", "active_users", "selected_plans", "selected_stores", "selected_users", "subscription_status", "integration_status", "custom_filter"]),
  audienceFilters: z.record(z.string(), z.unknown()).default({})
});

export async function POST(request) {
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const auth = await requireAdminPermission(request, "notifications", "read");
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "validation_error" }, { status: 400 });
  const estimate = await estimatePlatformNotificationAudience(parsed.data);
  return Response.json({ ok: true, estimate }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
