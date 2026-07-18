import crypto from "node:crypto";
import { requireSession } from "../../../../../src/server/session.js";
import { createSallaState } from "../../../../../src/lib/salla.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  if (!process.env.SALLA_CLIENT_ID || !process.env.SALLA_CLIENT_SECRET) {
    return Response.json({ ok: false, message: "إعداد تكامل سلة غير مكتمل على الخادم." }, { status: 503 });
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const redirectUri = process.env.SALLA_REDIRECT_URI || `${appUrl}/api/integrations/salla/callback`;
  const state = createSallaState({ tenantId: auth.session.tenantId, userId: auth.session.userId, nonce: crypto.randomUUID() });
  const url = new URL("https://accounts.salla.sa/oauth2/auth");
  url.searchParams.set("client_id", process.env.SALLA_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "offline_access");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return Response.redirect(url, 302);
}
