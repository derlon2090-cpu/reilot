import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { planEntitlementResponse } from "../../../../../src/server/plan-entitlements.js";
import { getPublicNewsletterProfile, subscribeToNewsletter } from "../../../../../src/server/newsletter.js";

function response(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  });
}

export async function GET(_request, { params }) {
  const { publicId } = await params;
  try {
    const profile = await getPublicNewsletterProfile(publicId);
    if (!profile) return response({ ok: false, message: "رابط النشرة غير صالح أو لم يعد متاحًا." }, 404);
    return response({ ok: true, profile: { publicId: profile.publicId, displayName: profile.displayName } });
  } catch {
    return response({ ok: false, message: "تعذر تحميل نموذج الاشتراك حاليًا." }, 503);
  }
}

export async function POST(request, { params }) {
  if (!sameOriginRequest(request)) return response({ ok: false, message: "تعذر التحقق من مصدر الطلب." }, 403);
  const { publicId } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.website) return response({ ok: true, alreadySubscribed: true });
  try {
    const result = await subscribeToNewsletter(publicId, body.email);
    return response({
      ok: true,
      alreadySubscribed: result.alreadySubscribed,
      message: result.alreadySubscribed ? "أنت مشترك في هذه النشرة بالفعل." : "تم الاشتراك في النشرة بنجاح."
    }, result.alreadySubscribed ? 200 : 201);
  } catch (error) {
    const entitlementResponse = planEntitlementResponse(error);
    if (entitlementResponse) return entitlementResponse;
    const status = Number(error?.status || 500);
    return response({ ok: false, reason: error?.reason, message: status < 500 ? error.message : "تعذر إتمام الاشتراك حاليًا." }, status);
  }
}
