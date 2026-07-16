import { GET as getOrderByNumber } from "./[orderNumber]/route.js";

function noStore(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Cache-Control", "no-store, private, max-age=0");
  return Response.json(body, { ...init, headers });
}

export async function GET(req, { params }) {
  const { storeSlug } = await params;
  const orderNumber = new URL(req.url).searchParams.get("orderNumber")?.trim().replace(/^#/, "") || "";
  if (!orderNumber || orderNumber.length > 100) {
    return noStore({ ok: false, reason: "order_number_required", message: "اكتب رقم الطلب الصحيح." }, { status: 400 });
  }
  return getOrderByNumber(req, { params: Promise.resolve({ storeSlug, orderNumber }) });
}
