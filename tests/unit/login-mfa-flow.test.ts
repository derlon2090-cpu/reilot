import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  queryMock,
  transactionMock,
  createSessionMock,
  decryptMfaSecretMock,
  verifyTotpMock
} = vi.hoisted(() => ({
  queryMock: vi.fn(),
  transactionMock: vi.fn(),
  createSessionMock: vi.fn(),
  decryptMfaSecretMock: vi.fn(),
  verifyTotpMock: vi.fn()
}));

vi.mock("../../src/server/db.js", () => ({
  query: queryMock,
  transaction: transactionMock
}));
vi.mock("../../src/server/session.js", () => ({ createSession: createSessionMock }));
vi.mock("../../src/server/mfa.js", () => ({
  decryptMfaSecret: decryptMfaSecretMock,
  verifyTotp: verifyTotpMock
}));

import { createMfaLoginChallenge, verifyMfaLogin } from "../../src/server/login-mfa.js";
import { sha256 } from "../../src/server/security.js";

const challengeId = "11111111-1111-4111-8111-111111111111";
const baseUser = { id: "user-1", tenantId: "tenant-1" };

function createClient() {
  return { query: vi.fn() };
}

async function signedChallenge() {
  const client = createClient();
  client.query.mockImplementation(async (sql: string) => {
    if (sql.includes("INSERT INTO auth_mfa_login_challenges")) {
      return { rows: [{ id: challengeId, expiresAt: new Date(Date.now() + 300_000) }] };
    }
    return { rows: [], rowCount: 0 };
  });
  transactionMock.mockImplementationOnce(async (callback: (client: ReturnType<typeof createClient>) => unknown) => callback(client));
  return (await createMfaLoginChallenge({ user: baseUser, ipAddress: "127.0.0.1", userAgent: "iPad" })).challengeCookie;
}

function verificationRow(overrides = {}) {
  return {
    id: challengeId,
    user_id: "user-1",
    tenant_id: "tenant-1",
    email: "owner@example.com",
    name: "Owner",
    role: "owner",
    mustChangePassword: false,
    mfaEnabled: true,
    mfaSecret: "encrypted-secret",
    recoveryHashes: [],
    attempts: 0,
    max_attempts: 5,
    expires_at: new Date(Date.now() + 300_000),
    consumed_at: null,
    invalidated_at: null,
    ...overrides
  };
}

describe("MFA login challenge", () => {
  beforeEach(() => {
    process.env.MFA_CHALLENGE_KEY = "test-mfa-challenge-key-with-32-characters";
    queryMock.mockReset();
    transactionMock.mockReset();
    createSessionMock.mockReset();
    decryptMfaSecretMock.mockReset().mockReturnValue("TOTPSECRET");
    verifyTotpMock.mockReset();
    createSessionMock.mockResolvedValue({ token: "session-token" });
  });

  it("creates a session only after a valid authenticator code", async () => {
    const rawCookie = await signedChallenge();
    const client = createClient();
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT c.*")) return { rows: [verificationRow()] };
      return { rows: [], rowCount: 1 };
    });
    transactionMock.mockImplementationOnce(async (callback: (client: ReturnType<typeof createClient>) => unknown) => callback(client));
    verifyTotpMock.mockReturnValue(true);

    const result = await verifyMfaLogin({ rawCookie, code: "123456", ipAddress: "127.0.0.1", userAgent: "iPad" });

    expect(result.ok).toBe(true);
    expect(createSessionMock).toHaveBeenCalledOnce();
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("consumed_at=now()"),
      [challengeId]
    );
  });

  it("does not create a session for an invalid code and consumes an attempt", async () => {
    const rawCookie = await signedChallenge();
    const client = createClient();
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT c.*")) return { rows: [verificationRow()] };
      return { rows: [], rowCount: 1 };
    });
    transactionMock.mockImplementationOnce(async (callback: (client: ReturnType<typeof createClient>) => unknown) => callback(client));
    verifyTotpMock.mockReturnValue(false);

    const result = await verifyMfaLogin({ rawCookie, code: "000000", ipAddress: "127.0.0.1", userAgent: "iPad" });

    expect(result).toMatchObject({ ok: false, reason: "invalid_code", attemptsRemaining: 4 });
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SET attempts=$2"), [challengeId, 1]);
  });

  it("accepts a recovery code once and removes its stored hash", async () => {
    const rawCookie = await signedChallenge();
    const recoveryCode = "ABCDE-FGHIJ";
    const client = createClient();
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT c.*")) return { rows: [verificationRow({ recoveryHashes: [sha256(recoveryCode)] })] };
      return { rows: [], rowCount: 1 };
    });
    transactionMock.mockImplementationOnce(async (callback: (client: ReturnType<typeof createClient>) => unknown) => callback(client));
    verifyTotpMock.mockReturnValue(false);

    const result = await verifyMfaLogin({ rawCookie, code: recoveryCode, ipAddress: "127.0.0.1", userAgent: "iPad" });

    expect(result.ok).toBe(true);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("mfa_recovery_hashes=$2::jsonb"),
      ["user-1", "[]"]
    );
  });

  it("rejects a tampered challenge cookie before touching the database", async () => {
    const rawCookie = await signedChallenge();
    transactionMock.mockClear();

    const result = await verifyMfaLogin({ rawCookie: `${rawCookie}tampered`, code: "123456", ipAddress: "127.0.0.1", userAgent: "iPad" });

    expect(result).toMatchObject({ ok: false, reason: "invalid_code" });
    expect(transactionMock).not.toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
  });
});
