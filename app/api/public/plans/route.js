import { getActivePlanCatalog } from "../../../../src/server/plan-catalog.js";

export async function GET() {
  const plans = await getActivePlanCatalog();
  return Response.json({ ok: true, plans }, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" }
  });
}
