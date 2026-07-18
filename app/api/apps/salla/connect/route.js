import { requireSession } from "../../../../../src/server/session.js";
import { createOauthState, sallaConfigured, sallaRedirectUri } from "../../../../../src/server/salla-app.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  if (!sallaConfigured()) return Response.json({ ok: false, message: "إعداد تكامل سلة غير مكتمل على الخادم." }, { status: 503 });
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const state = await createOauthState(auth.session.tenantId);
  const url = new URL("https://accounts.salla.sa/oauth2/auth");
  url.searchParams.set("client_id", process.env.SALLA_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "offline_access");
  url.searchParams.set("redirect_uri", sallaRedirectUri(origin));
  url.searchParams.set("state", state);
  return Response.redirect(url, 302);
}
