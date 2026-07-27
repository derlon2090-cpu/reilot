import { resolveSallaPublicPage } from "../../../../../src/server/salla-public-pages.js";

function response(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "Pragma": "no-cache",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer"
    }
  });
}

export async function GET(req, { params }) {
  const { publicId } = await params;
  const token = new URL(req.url).searchParams.get("t") || "";
  const result = await resolveSallaPublicPage(publicId, token);
  if (!result.ok) {
    return response(
      { ok: false, reason: result.reason, message: result.reason === "expired" ? "انتهت صلاحية الرابط." : "الرابط غير صالح أو تم إبطاله." },
      result.reason === "expired" ? 410 : 404
    );
  }
  return response({ ok: true, data: result.data });
}
