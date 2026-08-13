import { getActivePlanCatalog } from "../../../../src/server/plan-catalog.js";
import { authCorsHeaders, authCorsPreflight } from "../../../../src/server/auth-cors.js";

const catalogCacheMaxAgeMs = 6 * 60 * 60 * 1000;
let lastSuccessfulCatalog = null;

function responseHeaders(request, cacheControl) {
  return {
    ...authCorsHeaders(request),
    "Cache-Control": cacheControl,
    "Content-Type": "application/json; charset=utf-8"
  };
}

export async function GET(request) {
  try {
    const plans = await getActivePlanCatalog();
    lastSuccessfulCatalog = { plans, savedAt: Date.now() };
    return Response.json({ ok: true, plans }, {
      headers: responseHeaders(request, "public, max-age=60, s-maxage=300, stale-while-revalidate=1800")
    });
  } catch (error) {
    const cached = lastSuccessfulCatalog && Date.now() - lastSuccessfulCatalog.savedAt <= catalogCacheMaxAgeMs
      ? lastSuccessfulCatalog.plans
      : null;
    if (cached) {
      return Response.json({ ok: true, plans: cached, cached: true }, {
        headers: {
          ...responseHeaders(request, "public, max-age=30, s-maxage=60, stale-while-revalidate=600"),
          "X-Renvix-Catalog-Cache": "stale"
        }
      });
    }
    console.error("public plan catalog unavailable", String(error?.code || "PLAN_CATALOG_UNAVAILABLE"));
    return Response.json({ ok: false, reason: "plans_unavailable", message: "تعذر تحميل الباقات الحالية. حاول مرة أخرى بعد قليل." }, {
      status: 503,
      headers: responseHeaders(request, "no-store")
    });
  }
}

export function OPTIONS(request) {
  return authCorsPreflight(request, "GET, OPTIONS");
}
