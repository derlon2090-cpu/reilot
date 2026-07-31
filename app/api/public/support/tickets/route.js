import { createHash } from "node:crypto";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { createPublicTicket } from "../../../../../src/server/support-tickets.js";

function response(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "Pragma": "no-cache",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  });
}

function requestFingerprint(request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "";
  if (!address) return "";
  const salt = process.env.SUPPORT_RATE_LIMIT_SALT || process.env.AUTH_SECRET || process.env.SESSION_SECRET || "renvix-support";
  const agent = request.headers.get("user-agent") || "";
  return createHash("sha256").update(`${salt}:${address}:${agent}`).digest("hex");
}

export async function POST(request) {
  if (!sameOriginRequest(request)) {
    return response({ ok: false, message: "تعذر التحقق من مصدر الطلب." }, 403);
  }
  try {
    const input = await request.json();
    const item = await createPublicTicket(input, { requestFingerprint: requestFingerprint(request) });
    return response({ ok: true, item: { ticketNumber: item.ticketNumber } }, 201);
  } catch (error) {
    const status = Number(error?.status || 500);
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    const message = safeStatus < 500 ? error.message : "تعذر إرسال طلب الدعم حاليًا. حاول مرة أخرى بعد قليل.";
    return response({ ok: false, message }, safeStatus);
  }
}
