import { requireAdminPermission } from "../../../../src/server/admin-auth.js";
import { getAIProviderPricingAlerts, getAIProviderUsageSummary } from "../../../../src/server/ai/provider-accounting.js";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireAdminPermission(request, "overview", "read");
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get("days") || 30);
    const tenantId = url.searchParams.get("tenantId") || null;
    const [usage, pricingAlerts] = await Promise.all([
      getAIProviderUsageSummary({ tenantId, days }),
      getAIProviderPricingAlerts()
    ]);
    return Response.json({ ok: true, days: Math.max(1, Math.min(366, days)), usage, pricingAlerts });
  } catch {
    return Response.json({ ok: false, message: "تعذر تحميل محاسبة مزودي الذكاء حاليًا." }, { status: 500 });
  }
}
