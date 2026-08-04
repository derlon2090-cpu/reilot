import { resolveSallaPublicPage } from "../../../../../src/server/salla-public-pages.js";

const accessWindows = new Map();

function allowAccess(req, publicId) {
  const ip = String(req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown").split(",")[0].trim();
  const key = `${publicId}:${ip}`;
  const now = Date.now();
  const existing = accessWindows.get(key);
  const entry = !existing || now - existing.startedAt >= 60_000
    ? { startedAt: now, count: 1 }
    : { ...existing, count: existing.count + 1 };
  accessWindows.set(key, entry);
  if (accessWindows.size > 5000) {
    for (const [candidate, value] of accessWindows) {
      if (now - value.startedAt >= 60_000) accessWindows.delete(candidate);
    }
  }
  return entry.count <= 30;
}

function response(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "Pragma": "no-cache",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    }
  });
}

export async function GET(req, { params }) {
  const { publicId } = await params;
  if (!allowAccess(req, publicId)) return response({ ok: false, reason: "rate_limited", message: "طلبات كثيرة، حاول بعد دقيقة." }, 429);
  const token = new URL(req.url).searchParams.get("t") || "";
  const result = await resolveSallaPublicPage(publicId, token);
  if (!result.ok) {
    const message = result.reason === "expired"
      ? "انتهت صلاحية الرابط."
      : result.reason === "revoked"
        ? "تم إبطال الرابط بعد إلغاء الطلب أو استرجاعه."
        : result.reason === "view_limit_reached"
          ? "وصل الرابط إلى الحد المسموح لمرات العرض."
          : "الرابط غير صالح أو تم إبطاله.";
    return response(
      { ok: false, reason: result.reason, message },
      ["expired", "revoked", "view_limit_reached"].includes(result.reason) ? 410 : 404
    );
  }
  return response({ ok: true, data: result.data });
}
