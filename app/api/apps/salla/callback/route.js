import { query } from "../../../../../src/server/db.js";
import { consumeOauthState, registerSallaOperationalWebhooks, sallaRedirectUri, upsertSallaConnection } from "../../../../../src/server/salla-app.js";

function redirect(req, result) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  return Response.redirect(new URL(`/dashboard/apps?salla=${result}`, appUrl), 302);
}

export async function GET(req) {
  const url = new URL(req.url);
  const state = await consumeOauthState(url.searchParams.get("state"));
  const code = url.searchParams.get("code");
  if (!state || !code) return redirect(req, "invalid_state");
  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL || url.origin;
    const tokenResponse = await fetch("https://accounts.salla.sa/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code", client_id: process.env.SALLA_CLIENT_ID || "",
        client_secret: process.env.SALLA_CLIENT_SECRET || "", redirect_uri: sallaRedirectUri(origin), code
      })
    });
    const tokens = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokens.access_token) throw new Error(`Salla token exchange failed (${tokenResponse.status})`);
    const storeResponse = await fetch("https://accounts.salla.sa/oauth2/user/info", {
      headers: { authorization: `Bearer ${tokens.access_token}`, accept: "application/json" }
    });
    const info = await storeResponse.json().catch(() => ({}));
    if (!storeResponse.ok) throw new Error(`Salla store lookup failed (${storeResponse.status})`);
    const merchant = info.data?.merchant || info.data?.store || info.data || {};
    await upsertSallaConnection({ tenantId: state.tenantId, accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token, expiresIn: tokens.expires_in, scopes: tokens.scope, merchant });
    try {
      await registerSallaOperationalWebhooks(tokens.access_token, origin);
    } catch (webhookError) {
      await query(`INSERT INTO app_sync_logs (tenant_id, provider, event_type, status, message)
        VALUES ($1,'salla','webhook.registration','warning',$2)`, [state.tenantId, String(webhookError.message).slice(0,300)]).catch(() => {});
    }
    await query("INSERT INTO activity_logs (tenant_id, type, title) VALUES ($1, 'salla.connected', 'تم ربط متجر سلة')", [state.tenantId]);
    return redirect(req, "connected");
  } catch (error) {
    await query(`UPDATE app_connections SET status = 'error', last_error = $2, updated_at = now()
      WHERE tenant_id = $1 AND provider = 'salla'`, [state.tenantId, String(error.message).slice(0, 300)]).catch(() => {});
    return redirect(req, "failed");
  }
}
