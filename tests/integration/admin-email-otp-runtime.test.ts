import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditAdmin: vi.fn(),
  dbQuery: vi.fn(),
  deliveredCode: "",
  sendLoginEmailOtp: vi.fn()
}));

vi.mock("../../src/server/db.js", () => ({
  databaseFailureReason: vi.fn(() => "admin_auth_service_unavailable"),
  query: mocks.dbQuery,
  transaction: async (callback: (client: { query: typeof mocks.dbQuery }) => unknown) => callback({ query: mocks.dbQuery })
}));
vi.mock("../../src/server/admin-auth.js", () => ({
  auditAdmin: mocks.auditAdmin,
  requestIp: () => "127.0.0.1"
}));
vi.mock("../../src/server/password.js", () => ({
  hashPassword: vi.fn(async () => "updated-hash"),
  needsRehash: vi.fn(() => false),
  verifyPassword: vi.fn(async () => true)
}));
vi.mock("../../src/server/security-center.js", () => ({
  activeTemporaryMitigation: vi.fn(async () => null),
  findActiveSecurityBlock: vi.fn(async () => null),
  recordSecuritySignal: vi.fn(async () => undefined)
}));
vi.mock("../../src/server/email/resend.service.js", () => ({
  sendLoginEmailOtp: mocks.sendLoginEmailOtp
}));
vi.mock("../../src/server/default-templates.js", () => ({ ensureDefaultTemplates: vi.fn() }));
vi.mock("../../src/server/trusted-browser.js", () => ({
  TRUSTED_BROWSER_COOKIE: "__Host-rvx_trusted_browser",
  TRUSTED_BROWSER_DEV_COOKIE: "rvx_trusted_browser_dev",
  hashBrowserToken: vi.fn(),
  trustBrowserForUser: vi.fn(),
  trustedBrowserAgeSeconds: () => 48 * 60 * 60,
  trustedBrowserEnabled: () => true,
  validateTrustedBrowser: vi.fn(),
  revokeAllUserBrowsers: vi.fn()
}));

import { POST as login } from "../../app/api/admin/auth/login/route.js";
import { GET as status } from "../../app/api/auth/email-otp/status/route.js";
import { POST as verify } from "../../app/api/auth/email-otp/verify/route.js";

const envKeys = ["NODE_ENV", "COOKIE_SECURE", "RESEND_API_KEY", "EMAIL_OTP_PEPPER"] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

describe("admin email OTP single-runtime lifecycle", () => {
  let challenge: Record<string, unknown> | null;

  beforeEach(() => {
    vi.clearAllMocks();
    challenge = null;
    mocks.deliveredCode = "";
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SECURE = "true";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_OTP_PEPPER = "admin-runtime-email-otp-pepper-is-long-enough";

    mocks.sendLoginEmailOtp.mockImplementation(async ({ code }: { code: string }) => {
      mocks.deliveredCode = code;
      return { id: "email-1" };
    });
    mocks.dbQuery.mockImplementation(async (sql: string, values: unknown[] = []) => {
      const statement = String(sql).replace(/\s+/g, " ").trim();

      if (statement.includes("FROM login_attempts")) return { rows: [{ count: 0 }] };
      if (statement.includes("FROM users u") && statement.includes("JOIN accounts a")) {
        return { rows: [{
          userId: "22222222-2222-4222-8222-222222222222",
          tenantId: null,
          name: "Admin",
          email: "admin@example.com",
          credentialId: "credential-1",
          passwordHash: "stored-hash",
          adminId: "admin-1",
          adminRole: "super_admin",
          status: "active",
          mfaEnabled: false,
          mfaSecret: null,
          expiresAt: null
        }] };
      }
      if (statement.includes("INSERT INTO login_attempts")) {
        return { rows: [{ id: "44444444-4444-4444-8444-444444444444" }] };
      }
      if (statement.includes("SELECT id, expires_at") && statement.includes("auth_email_otp_challenges")) {
        return { rows: [] };
      }
      if (statement.includes("INSERT INTO auth_email_otp_challenges")) {
        const now = new Date();
        challenge = {
          id: values[0],
          user_id: values[1],
          tenant_id: values[2],
          purpose: values[3],
          code_digest: values[4],
          expires_at: new Date(now.getTime() + 5 * 60 * 1000),
          last_sent_at: now,
          attempts: 0,
          max_attempts: 5,
          consumed_at: null,
          invalidated_at: null,
          email: "admin@example.com",
          name: "Admin",
          mustChangePassword: false,
          role: "super_admin"
        };
        return { rows: [{ id: challenge.id, expiresAt: challenge.expires_at, lastSentAt: challenge.last_sent_at }] };
      }
      if (statement.includes("FROM auth_email_otp_challenges c JOIN users u") && statement.includes("FOR UPDATE OF c")) {
        return { rows: challenge ? [{ ...challenge }] : [] };
      }
      if (statement.includes("FROM auth_email_otp_challenges c JOIN users u")) {
        return { rows: challenge ? [{ ...challenge }] : [] };
      }
      if (statement.includes("UPDATE auth_email_otp_challenges SET consumed_at")) {
        if (challenge) challenge.consumed_at = new Date();
        return { rows: [] };
      }
      return { rows: [] };
    });
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("creates, reads, and verifies one admin challenge before issuing a host-only admin session", async () => {
    const loginResponse = await login(new Request("https://wa-admin.renvix.app/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "otp-runtime-test" },
      body: JSON.stringify({ email: "admin@example.com", password: "correct-password" })
    }));

    expect(loginResponse.status).toBe(202);
    expect(mocks.deliveredCode).toMatch(/^\d{6}$/);
    const challengeSetCookie = loginResponse.headers.get("set-cookie") || "";
    expect(challengeSetCookie).toContain("renvix_admin_email_otp_challenge=");
    expect(challengeSetCookie).not.toContain("Domain=");
    const challengePair = challengeSetCookie.match(/renvix_admin_email_otp_challenge=[^;]+/)?.[0];
    expect(challengePair).toBeTruthy();

    const statusResponse = await status(new Request("https://wa-admin.renvix.app/api/auth/email-otp/status", {
      headers: { cookie: challengePair || "" }
    }));
    expect(statusResponse.status).toBe(200);
    await expect(statusResponse.json()).resolves.toMatchObject({ ok: true, purpose: "admin_login" });

    const verifyResponse = await verify(new Request("https://wa-admin.renvix.app/api/auth/email-otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: challengePair || "", "User-Agent": "otp-runtime-test" },
      body: JSON.stringify({ code: mocks.deliveredCode })
    }));

    expect(verifyResponse.status).toBe(200);
    await expect(verifyResponse.json()).resolves.toMatchObject({ ok: true, redirectUrl: "/admin" });
    const sessionCookies = verifyResponse.headers.get("set-cookie") || "";
    expect(sessionCookies).toContain("renvix_admin_session=");
    expect(sessionCookies).toContain("SameSite=Strict");
    expect(sessionCookies).not.toContain("renewpilot_session=");
    expect(sessionCookies).not.toContain("Domain=");
    expect(challenge?.consumed_at).toBeInstanceOf(Date);
  });
});
