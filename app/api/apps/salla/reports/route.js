import { requireSession } from "../../../../../src/server/session.js";
import { getSallaReports } from "../../../../../src/server/salla-reports.js";

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function reportFilters(url) {
  return {
    period: url.searchParams.get("period") || "30",
    dateFrom: url.searchParams.get("dateFrom") || "",
    dateTo: url.searchParams.get("dateTo") || "",
    search: url.searchParams.get("search") || "",
    status: url.searchParams.get("status") || "",
    channel: url.searchParams.get("channel") || "",
    minValue: url.searchParams.get("minValue") || "",
    maxValue: url.searchParams.get("maxValue") || ""
  };
}

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const payload = await getSallaReports({ tenantId: auth.session.tenantId, filters: reportFilters(url) });
    if (url.searchParams.get("format") !== "csv") {
      return Response.json({ ok: true, ...payload }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
    }
    if (!payload.available) return Response.json({ ok: false, message: "اربط متجر سلة أولًا." }, { status: 409 });
    const labels = { abandoned: "متروكة", recovering: "قيد الاستعادة", recovered: "تمت الاستعادة", purchased_later: "تم الشراء لاحقًا", expired: "انتهت", excluded: "مستبعدة" };
    const rows = [
      ["العميل", "البريد", "الجوال", "معرف السلة", "قيمة السلة", "العملة", "تاريخ الترك", "الحالة", "القناة", "آخر محاولة", "الطلب المرتبط"],
      ...payload.items.map((item) => [item.customerName || "عميل غير معروف", item.customerEmail, item.customerPhone, item.externalCartId, item.cartValue, item.currency, item.abandonedAt, labels[item.state] || item.state, item.channel, item.lastAttemptAt, item.orderNumber || item.convertedOrderId])
    ];
    const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="salla-carts-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || "تعذر تحميل تقارير سلة." }, { status: error.status || 500 });
  }
}
