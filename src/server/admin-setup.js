import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { hashBcryptPassword } from "./password.js";
import { createSession } from "./session.js";
import { classifyPasswordStrength } from "./security-score.js";
import { isValidEmail, normalizeEmail, randomToken } from "./security.js";

export const ADMIN_SETUP_CSRF_COOKIE = "renvix_admin_setup_csrf";
export const ADMIN_SETUP_ACCESS_COOKIE = "renvix_admin_setup_access";
const SETUP_LOCK_KEY = "renvix:first-admin-setup:v1";
const SETUP_ACCESS_AGE_SECONDS = 10 * 60;
const attempts = new Map();

export class AdminSetupError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AdminSetupError";
    this.code = code;
  }
}

function secureEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left || "")).digest();
  const rightHash = crypto.createHash("sha256").update(String(right || "")).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

export function verifyAdminSetupToken(candidate) {
  const configured = String(process.env.ADMIN_SETUP_TOKEN || "");
  if (configured.length < 32 || String(candidate || "").length < 1) return false;
  return secureEqual(candidate, configured);
}

export function allowLocalAdminSetup(request) {
  if (process.env.ADMIN_SETUP_ALLOW_LOCALHOST !== "true") return false;
  try {
    const hostname = new URL(request.url).hostname.toLowerCase();
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}

function setupCookieSecureAttribute() {
  if (process.env.COOKIE_SECURE === "false") return "";
  return process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
}

export function issueAdminSetupAccessToken(now = Date.now()) {
  const configured = String(process.env.ADMIN_SETUP_TOKEN || "");
  if (configured.length < 32) return "";
  const expiresAt = Math.floor(now / 1000) + SETUP_ACCESS_AGE_SECONDS;
  const payload = Buffer.from(String(expiresAt)).toString("base64url");
  const signature = crypto.createHmac("sha256", configured).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAdminSetupAccessToken(candidate, now = Date.now()) {
  const configured = String(process.env.ADMIN_SETUP_TOKEN || "");
  const [payload, signature, extra] = String(candidate || "").split(".");
  if (configured.length < 32 || !payload || !signature || extra) return false;
  const expected = crypto.createHmac("sha256", configured).update(payload).digest("base64url");
  if (!secureEqual(signature, expected)) return false;
  const expiresAt = Number(Buffer.from(payload, "base64url").toString("utf8"));
  return Number.isSafeInteger(expiresAt) && expiresAt >= Math.floor(now / 1000);
}

export function validateAdminSetupPassword(password, identity = "") {
  const value = String(password || "");
  const lower = value.toLowerCase();
  const weakTerms = ["password", "qwerty", "123456", "admin", "renvix", "welcome", "letmein", "changeme"];
  if (value.length < 12) return "يجب ألا تقل كلمة المرور عن 12 خانة.";
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value)) return "يجب أن تحتوي كلمة المرور على حرف كبير وحرف صغير.";
  if (!/\d/.test(value)) return "يجب أن تحتوي كلمة المرور على رقم واحد على الأقل.";
  if (!/[^A-Za-z\d]/.test(value)) return "يجب أن تحتوي كلمة المرور على رمز خاص واحد على الأقل.";
  if (weakTerms.some((term) => lower.includes(term))) return "كلمة المرور تحتوي على عبارة ضعيفة أو متوقعة.";
  const identityPart = String(identity || "").toLowerCase().split("@")[0].replace(/[^a-z0-9]/g, "");
  if (identityPart.length >= 4 && lower.replace(/[^a-z0-9]/g, "").includes(identityPart)) return "يجب ألا تحتوي كلمة المرور على جزء من البريد الإلكتروني.";
  return null;
}

export function validateAdminSetupInput(input) {
  const name = String(input?.name || "").trim();
  const email = normalizeEmail(input?.email);
  const password = String(input?.password || "");
  const confirmPassword = String(input?.confirmPassword || "");
  const errors = {};
  if (name.length < 2 || name.length > 100) errors.name = "أدخل اسمًا صحيحًا من 2 إلى 100 خانة.";
  if (!isValidEmail(email) || email.length > 254) errors.email = "أدخل بريدًا إلكترونيًا صحيحًا.";
  const passwordError = validateAdminSetupPassword(password, email);
  if (passwordError) errors.password = passwordError;
  if (password !== confirmPassword) errors.confirmPassword = "تأكيد كلمة المرور غير مطابق.";
  return { ok: Object.keys(errors).length === 0, errors, value: { name, email, password } };
}

export function consumeAdminSetupRateLimit(key, { limit = 8, windowMs = 15 * 60 * 1000, now = Date.now() } = {}) {
  const normalizedKey = String(key || "unknown");
  const recent = (attempts.get(normalizedKey) || []).filter((createdAt) => now - createdAt < windowMs);
  if (recent.length >= limit) {
    attempts.set(normalizedKey, recent);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000)) };
  }
  recent.push(now);
  attempts.set(normalizedKey, recent);
  return { ok: true };
}

export function resetAdminSetupRateLimitForTests() {
  attempts.clear();
}

export function adminSetupCsrfCookie(token, maxAge = 10 * 60) {
  return `${ADMIN_SETUP_CSRF_COOKIE}=${encodeURIComponent(token)}; Path=/api/admin/setup; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, maxAge)}${setupCookieSecureAttribute()}`;
}

export function adminSetupAccessCookie(token, maxAge = SETUP_ACCESS_AGE_SECONDS) {
  return `${ADMIN_SETUP_ACCESS_COOKIE}=${encodeURIComponent(token)}; Path=/api/admin/setup; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, maxAge)}${setupCookieSecureAttribute()}`;
}

export function readCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  const item = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}

export function verifyAdminSetupCsrf(request) {
  const header = request.headers.get("x-csrf-token") || "";
  const cookie = readCookie(request, ADMIN_SETUP_CSRF_COOKIE);
  return Boolean(header && cookie && secureEqual(header, cookie));
}

export function verifyAdminSetupAccess(request) {
  return verifyAdminSetupAccessToken(readCookie(request, ADMIN_SETUP_ACCESS_COOKIE));
}

export function verifySameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function getAdminSetupState(queryFn = query) {
  const result = await queryFn("SELECT count(*)::int AS count FROM admin_users");
  return { configured: Number(result.rows[0]?.count || 0) > 0 };
}

export async function createFirstAdmin(input, {
  transactionFn = transaction,
  hashPasswordFn = hashBcryptPassword,
  createSessionFn = createSession
} = {}) {
  const parsed = validateAdminSetupInput(input);
  if (!parsed.ok) throw new AdminSetupError("validation_error", "بيانات الإعداد غير صالحة.");

  return transactionFn(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [SETUP_LOCK_KEY]);
    const existingAdmin = await client.query("SELECT count(*)::int AS count FROM admin_users");
    if (Number(existingAdmin.rows[0]?.count || 0) > 0) {
      throw new AdminSetupError("already_configured", "تم إعداد حساب المسؤول مسبقًا");
    }
    const usedEmail = await client.query("SELECT id FROM users WHERE lower(email) = $1 LIMIT 1", [parsed.value.email]);
    if (usedEmail.rows[0]) throw new AdminSetupError("email_in_use", "البريد الإلكتروني مستخدم مسبقًا.");

    const passwordHash = await hashPasswordFn(parsed.value.password, 12);
    const passwordStrength = classifyPasswordStrength(parsed.value.password, parsed.value.email);
    const userResult = await client.query(
      `INSERT INTO users
         (tenant_id, name, email, email_verified, role, password_strength, password_changed_at)
       VALUES (NULL, $1, $2, true, 'admin', $3, now())
       RETURNING id, name, email`,
      [parsed.value.name, parsed.value.email, passwordStrength]
    );
    const user = userResult.rows[0];
    await client.query(
      `INSERT INTO accounts (user_id, account_id, provider_id, password)
       VALUES ($1, $2, 'credential', $3)`,
      [user.id, parsed.value.email, passwordHash]
    );
    const adminResult = await client.query(
      `INSERT INTO admin_users (user_id, role, status, mfa_enabled, expires_at)
       VALUES ($1, 'super_admin', 'active', false, NULL)
       RETURNING id, role`,
      [user.id]
    );
    const admin = adminResult.rows[0];
    await client.query(
      `INSERT INTO admin_audit_logs
         (admin_user_id, user_id, actor_email, action, resource, status, metadata)
       VALUES ($1, $2, $3, 'admin.initial_setup.completed', 'admin_users', 'success', $4::jsonb)`,
      [admin.id, user.id, user.email, JSON.stringify({ role: admin.role, source: "admin_setup" })]
    );
    const session = await createSessionFn(client, {
      userId: user.id,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      maxAgeSeconds: 60 * 60 * 12
    });
    return { user, admin, session };
  });
}

export function issueAdminSetupCsrfToken() {
  return randomToken(32);
}
