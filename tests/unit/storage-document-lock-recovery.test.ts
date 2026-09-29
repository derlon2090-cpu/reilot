import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), hashPassword: vi.fn(), mailer: vi.fn() }));
vi.mock("../../src/server/db.js", () => ({ query: mocks.query, transaction: mocks.transaction }));
vi.mock("../../src/server/password.js", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("../../src/server/email/resend.service.js", () => ({ sendStorageDocumentLockResetCodeEmail: mocks.mailer }));

import { requestStorageDocumentLockRecovery, resetStorageDocumentLockPassword } from "../../src/server/storage-document-lock-recovery.js";

const session = {
  tenantId: "a1111111-1111-4111-8111-111111111111",
  userId: "b1111111-1111-4111-8111-111111111111",
  email: "owner@example.test"
};
const documentId = "c1111111-1111-4111-8111-111111111111";
const pepper = "storage-lock-recovery-test-pepper-long-enough";

describe("storage document lock email recovery", () => {
  beforeEach(() => {
    process.env.EMAIL_OTP_PEPPER = pepper;
    mocks.query.mockReset();
    mocks.transaction.mockReset();
    mocks.hashPassword.mockReset();
    mocks.mailer.mockReset();
  });

  it("sends a one-time code while storing only its keyed hash", async () => {
    let deliveredCode = "";
    mocks.query.mockResolvedValueOnce({ rows: [{ id: documentId, title: "ملف مهم" }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 91 }] })
      .mockResolvedValueOnce({ rows: [] });
    const mailer = vi.fn(async (input) => { deliveredCode = input.code; return { id: "mail-1" }; });

    await expect(requestStorageDocumentLockRecovery(session, documentId, { mailer })).resolves.toMatchObject({ maskedEmail: "ow***@example.test" });
    expect(deliveredCode).toMatch(/^\d{6}$/);
    const insert = mocks.query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO storage_document_lock_recovery_codes"));
    expect(insert?.[1]?.[3]).toMatch(/^[a-f0-9]{64}$/);
    expect(insert?.[1]?.[3]).not.toBe(deliveredCode);
    expect(mailer).toHaveBeenCalledWith(expect.objectContaining({ to: session.email, documentTitle: "ملف مهم" }));
  });

  it("accepts the emailed code once and replaces the document password hash", async () => {
    const code = "482911";
    const codeHash = crypto.createHmac("sha256", pepper).update(code).digest("hex");
    const client = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 14, codeHash, expiresAt: new Date(Date.now() + 60_000), attempts: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }) };
    mocks.transaction.mockImplementation(async (callback) => callback(client));
    mocks.hashPassword.mockResolvedValue("$argon2id$replacement");

    await expect(resetStorageDocumentLockPassword(session, documentId, { code, password: "NewDocumentPassword!" })).resolves.toEqual({ locked: true });
    expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining("UPDATE storage_document_locks"), ["$argon2id$replacement", documentId, session.tenantId]);
    expect(client.query).toHaveBeenNthCalledWith(3, expect.stringContaining("SET used_at=now()"), [documentId, session.tenantId, session.userId]);
  });

  it("commits an attempt count before rejecting an incorrect code", async () => {
    const codeHash = crypto.createHmac("sha256", pepper).update("482911").digest("hex");
    const client = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 15, codeHash, expiresAt: new Date(Date.now() + 60_000), attempts: 0 }] })
      .mockResolvedValueOnce({ rows: [] }) };
    mocks.transaction.mockImplementation(async (callback) => callback(client));

    await expect(resetStorageDocumentLockPassword(session, documentId, { code: "111111", password: "NewDocumentPassword!" }))
      .rejects.toMatchObject({ code: "DOCUMENT_LOCK_RECOVERY_CODE_INVALID", status: 400 });
    expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining("attempts=attempts+1"), [15]);
    expect(mocks.hashPassword).not.toHaveBeenCalled();
  });
});
