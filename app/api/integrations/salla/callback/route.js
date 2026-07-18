import { query } from "../../../../../src/server/db.js";
import { encryptSecret } from "../../../../../src/lib/encryption.js";
import { verifySallaState } from "../../../../../src/lib/salla.js";

function dashboardRedirect(req, value) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  return Response.redirect(new URL(`/dashboard/subscriptions?salla=${value}`, appUrl), 302);
}

export async function GET(req) {
  const url = new URL(req.url);
  const state = verifySallaState(url.searchParams.get("state"));
  const code = url.searchParams.get("code");
  if (!state || !code) return dashboardRedirect(req, "invalid_state");
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;
    const redirectUri = process.env.SALLA_REDIRECT_URI || `${appUrl}/api/integrations/salla/callback`;
    const tokenResponse = await fetch("https://accounts.salla.sa/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.SALLA_CLIENT_ID || "",
        client_secret: process.env.SALLA_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        code
      })
    });
    const tokens = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokens.access_token) throw new Error(`Salla token exchange failed (${tokenResponse.status})`);
    const userResponse = await fetch("https://accounts.salla.sa/oauth2/user/info", {
      headers: { authorization: `Bearer ${tokens.access_token}`, accept: "application/json" }
    });
    const userInfo = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok) throw new Error(`Salla merchant lookup failed (${userResponse.status})`);
    const merchant = userInfo.data?.merchant || userInfo.data?.store || userInfo.data || {};
    const merchantId = String(merchant.id || merchant.merchant_id || userInfo.data?.id || "").trim();
    const storeName = String(merchant.name || merchant.store_name || userInfo.data?.name || "متجر سلة").trim();
    if (!merchantId) throw new Error("Salla merchant id is missing");
    const expiresAt = tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000) : null;
    await query(
      `INSERT INTO commerce_integrations
        (tenant_id, provider, status, merchant_id, store_name, access_token_encrypted,
         refresh_token_encrypted, token_expires_at, last_error)
       VALUES ($1, 'salla', 'connected', $2, $3, $4, $5, $6, NULL)
       ON CONFLICT (tenant_id, provider) DO UPDATE SET
         status = 'connected', merchant_id = EXCLUDED.merchant_id, store_name = EXCLUDED.store_name,
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
         token_expires_at = EXCLUDED.token_expires_at, last_error = NULL, updated_at = now()`,
      [state.tenantId, merchantId, storeName, encryptSecret(tokens.access_token, process.env.ENCRYPTION_KEY), tokens.refresh_token ? encryptSecret(tokens.refresh_token, process.env.ENCRYPTION_KEY) : null, expiresAt]
    );
    await query("INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata) VALUES ($1, $2, 'salla.connected', 'Salla store connected', $3::jsonb)", [state.tenantId, state.userId, JSON.stringify({ storeName })]);
    return dashboardRedirect(req, "connected");
  } catch (error) {
    await query("UPDATE commerce_integrations SET status = 'error', last_error = $1, updated_at = now() WHERE tenant_id = $2 AND provider = 'salla'", [String(error.message).slice(0, 300), state.tenantId]).catch(() => {});
    return dashboardRedirect(req, "failed");
  }
}
