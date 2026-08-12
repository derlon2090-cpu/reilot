import crypto from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { transaction, query } from "./db.js";
import { ensureDefaultTemplates } from "./default-templates.js";
import { createSession } from "./session.js";
import { normalizeEmail, sha256 } from "./security.js";
import { createMfaLoginChallenge } from "./login-mfa.js";
import { createLoginEmailOtpChallenge } from "./email-otp-v2.js";
import { resolveSecondFactor } from "./second-factor-router.js";
import { secureCookieEnabled } from "./cookie-policy.js";

export const GOOGLE_NONCE_COOKIE = "renvix_google_nonce";
const NONCE_AGE_SECONDS = 10 * 60;
const oauthClient = new OAuth2Client();

function emailOtpDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim()) && String(process.env.EMAIL_OTP_PEPPER || "").trim().length >= 24;
}

function cookieValue(req, name) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export function createGoogleNonce() {
  const nonce = crypto.randomBytes(32).toString("base64url");
  return { nonce, digest: sha256(nonce) };
}

export function googleNonceCookie(digest, maxAge = NONCE_AGE_SECONDS) {
  const secure = secureCookieEnabled() ? "; Secure" : "";
  return `${GOOGLE_NONCE_COOKIE}=${encodeURIComponent(digest || "")}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Number(maxAge) || 0)}${secure}`;
}

export function readGoogleNonceDigest(req) {
  return cookieValue(req, GOOGLE_NONCE_COOKIE);
}

export function clearGoogleNonceCookie() {
  return googleNonceCookie("", 0);
}

export function googleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
}

export async function verifyGoogleCredential({ credential, expectedNonceDigest, verifier = oauthClient }) {
  const audience = googleClientId();
  if (!audience) return { ok: false, status: 503, reason: "google_not_configured" };
  if (!credential || !expectedNonceDigest) return { ok: false, status: 400, reason: "google_nonce_invalid" };
  try {
    const ticket = await verifier.verifyIdToken({ idToken: credential, audience });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return { ok: false, status: 401, reason: "google_identity_invalid" };
    }
    if (!payload.nonce || sha256(String(payload.nonce)) !== expectedNonceDigest) {
      return { ok: false, status: 401, reason: "google_nonce_invalid" };
    }
    return {
      ok: true,
      profile: {
        subject: String(payload.sub),
        email: normalizeEmail(payload.email),
        emailVerified: true,
        name: String(payload.name || payload.given_name || payload.email.split("@")[0]).trim().slice(0, 160),
        picture: /^https:\/\//i.test(String(payload.picture || "")) ? String(payload.picture).slice(0, 1000) : "",
        hostedDomain: String(payload.hd || "").trim().toLowerCase()
      }
    };
  } catch {
    return { ok: false, status: 401, reason: "google_token_invalid" };
  }
}

export function googleAutoLinkAllowed(profile) {
  const domain = profile.email.split("@")[1]?.toLowerCase() || "";
  return profile.emailVerified === true && (domain === "gmail.com" || Boolean(profile.hostedDomain));
}

function safeUser(row) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    email: row.email,
    image: row.image || "",
    role: row.role,
    mustChangePassword: row.mustChangePassword === true
  };
}

async function loadGoogleUser(client, profile) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`google:${profile.subject}:${profile.email}`]);
  const linked = await client.query(
    `SELECT u.id,u.tenant_id AS "tenantId",u.name,u.email,u.image,
            u.must_change_password AS "mustChangePassword",u.email_otp_enabled AS "emailOtpEnabled",
            u.mfa_enabled AS "mfaEnabled",u.mfa_secret_encrypted AS "mfaSecret",
            COALESCE(tm.role,u.role) AS role
       FROM accounts a JOIN users u ON u.id=a.user_id
       JOIN tenants t ON t.id=u.tenant_id AND t.status <> 'disabled'
       LEFT JOIN tenant_members tm ON tm.user_id=u.id AND tm.tenant_id=u.tenant_id
      WHERE a.provider_id='google' AND a.account_id=$1 LIMIT 1 FOR UPDATE OF a,u`,
    [profile.subject]
  );
  if (linked.rows[0]) {
    await client.query("UPDATE users SET name=COALESCE(NULLIF($2,''),name),image=COALESCE(NULLIF($3,''),image),email_verified=true,email_verified_at=COALESCE(email_verified_at,now()),updated_at=now() WHERE id=$1", [linked.rows[0].id, profile.name, profile.picture]);
    return { user: { ...linked.rows[0], name: profile.name || linked.rows[0].name, image: profile.picture || linked.rows[0].image }, created: false, linked: false };
  }

  const existing = await client.query(
    `SELECT u.id,u.tenant_id AS "tenantId",u.name,u.email,u.image,
            u.must_change_password AS "mustChangePassword",u.email_otp_enabled AS "emailOtpEnabled",
            u.mfa_enabled AS "mfaEnabled",u.mfa_secret_encrypted AS "mfaSecret",
            COALESCE(tm.role,u.role) AS role
       FROM users u JOIN tenants t ON t.id=u.tenant_id AND t.status <> 'disabled'
       LEFT JOIN tenant_members tm ON tm.user_id=u.id AND tm.tenant_id=u.tenant_id
      WHERE lower(u.email)=$1 LIMIT 1 FOR UPDATE OF u`,
    [profile.email]
  );
  if (existing.rows[0]) {
    if (!googleAutoLinkAllowed(profile)) return { error: { ok: false, status: 409, reason: "account_link_verification_required" } };
    await client.query("INSERT INTO accounts (user_id,account_id,provider_id) VALUES ($1,$2,'google') ON CONFLICT DO NOTHING", [existing.rows[0].id, profile.subject]);
    await client.query("UPDATE users SET email_verified=true,email_verified_at=COALESCE(email_verified_at,now()),image=COALESCE(NULLIF($2,''),image),updated_at=now() WHERE id=$1", [existing.rows[0].id, profile.picture]);
    return { user: { ...existing.rows[0], image: profile.picture || existing.rows[0].image }, created: false, linked: true };
  }

  const workspace = profile.name || profile.email.split("@")[0] || "Renvix";
  const slugBase = workspace.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "renvix";
  const tenant = await client.query("INSERT INTO tenants (name,slug,status) VALUES ($1,$2,'trial') RETURNING id", [workspace, `${slugBase}-${crypto.randomBytes(4).toString("hex")}`]);
  const tenantId = tenant.rows[0].id;
  const inserted = await client.query(
    `INSERT INTO users
       (tenant_id,name,email,email_verified,email_verified_at,image,role,email_otp_enabled,must_change_password)
     VALUES ($1,$2,$3,true,now(),NULLIF($4,''),'owner',true,false)
     RETURNING id,tenant_id AS "tenantId",name,email,image,role,must_change_password AS "mustChangePassword",
               email_otp_enabled AS "emailOtpEnabled",mfa_enabled AS "mfaEnabled",mfa_secret_encrypted AS "mfaSecret"`,
    [tenantId, workspace, profile.email, profile.picture]
  );
  const user = inserted.rows[0];
  await client.query("INSERT INTO accounts (user_id,account_id,provider_id) VALUES ($1,$2,'google')", [user.id, profile.subject]);
  await client.query("INSERT INTO tenant_members (tenant_id,user_id,role) VALUES ($1,$2,'owner')", [tenantId, user.id]);
  await client.query("INSERT INTO stores (tenant_id,name) VALUES ($1,$2)", [tenantId, workspace]);
  await client.query("INSERT INTO settings (tenant_id,language,theme) VALUES ($1,'ar','light') ON CONFLICT DO NOTHING", [tenantId]);
  await client.query("INSERT INTO whatsapp_safety_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING", [tenantId]).catch(() => null);
  await ensureDefaultTemplates(client, tenantId, workspace);
  const trial = await client.query("SELECT id FROM platform_plans WHERE slug='trial' LIMIT 1");
  if (!trial.rows[0]) throw new Error("Trial policy is not configured");
  await client.query(
    `INSERT INTO platform_subscriptions (tenant_id,plan_id,status,current_period_start,current_period_end,trial_started_at,trial_ends_at)
     VALUES ($1,$2,'trial',now(),now()+interval '7 days',now(),now()+interval '7 days')`,
    [tenantId, trial.rows[0].id]
  );
  return { user, created: true, linked: false };
}

async function providerRateLimited(ipHash) {
  try {
    const result = await query(
      `SELECT count(*)::int AS count FROM auth_provider_attempts
        WHERE provider_id='google' AND ip_hash=$1 AND created_at > now()-interval '15 minutes'`,
      [ipHash]
    );
    return Number(result.rows[0]?.count || 0) >= 20;
  } catch (error) {
    if (error?.code === "42P01") return false;
    throw error;
  }
}

async function recordProviderAttempt(ipHash, success, reason = null) {
  await query("INSERT INTO auth_provider_attempts (provider_id,ip_hash,success,failure_reason) VALUES ('google',$1,$2,$3)", [ipHash, success, reason]).catch((error) => {
    if (error?.code !== "42P01") throw error;
  });
}

export async function authenticateGoogle({ profile, ipAddress, userAgent, trustedDeviceToken = "", locale = "ar" }) {
  const ipHash = sha256(String(ipAddress || "unknown"));
  if (await providerRateLimited(ipHash)) return { ok: false, status: 429, reason: "rate_limited" };
  let resolved;
  try {
    resolved = await transaction((client) => loadGoogleUser(client, profile));
  } catch (error) {
    await recordProviderAttempt(ipHash, false, "database_error");
    throw error;
  }
  if (resolved.error) {
    await recordProviderAttempt(ipHash, false, resolved.error.reason);
    return resolved.error;
  }
  const user = resolved.user;
  const attempt = await query(
    `INSERT INTO login_attempts (email,email_hash,ip_address,user_agent,success,failure_reason)
     VALUES ($1,$2,$3,$4,true,NULL) RETURNING id`,
    [user.email, sha256(user.email), ipAddress || null, userAgent || null]
  );
  const factor = await resolveSecondFactor({ user, rawBrowserToken: trustedDeviceToken, riskDetected: false });
  if (factor.method === "totp") {
    const challenge = await createMfaLoginChallenge({ user, ipAddress, userAgent, loginAttemptId: attempt.rows[0]?.id });
    await recordProviderAttempt(ipHash, true);
    return { ok: true, status: 202, requiresMfa: true, challenge, user: safeUser(user) };
  }
  if (factor.method === "email_otp") {
    if (!emailOtpDeliveryConfigured()) return { ok: false, status: 503, reason: "email_otp_unavailable" };
    const challenge = await createLoginEmailOtpChallenge({ user, ipAddress, userAgent, locale, purpose: "login", loginAttemptId: attempt.rows[0]?.id });
    await recordProviderAttempt(ipHash, true);
    return { ok: true, status: 202, requiresEmailOtp: true, challenge, user: safeUser(user) };
  }
  if (factor.method === "unavailable") return { ok: false, status: 503, reason: "second_factor_unavailable" };
  const session = await transaction(async (client) => {
    const created = await createSession(client, { userId: user.id, ipAddress, userAgent });
    await client.query("INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata) VALUES ($1,$2,'auth.google.login','Signed in with Google',$3::jsonb)", [user.tenantId, user.id, JSON.stringify({ created: resolved.created, linked: resolved.linked })]);
    return created;
  });
  await recordProviderAttempt(ipHash, true);
  return { ok: true, status: resolved.created ? 201 : 200, user: safeUser(user), session };
}
