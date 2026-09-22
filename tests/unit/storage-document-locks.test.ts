import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), hashPassword: vi.fn(), verifyPassword: vi.fn() }));
vi.mock("../../src/server/db.js", () => ({ query: mocks.query }));
vi.mock("../../src/server/password.js", () => ({ hashPassword: mocks.hashPassword, verifyPassword: mocks.verifyPassword }));

import { requireStorageDocumentPassword, setStorageDocumentPassword } from "../../src/server/storage-document-locks.js";

const session = { tenantId: "a1111111-1111-4111-8111-111111111111", userId: "b1111111-1111-4111-8111-111111111111" };
const documentId = "c1111111-1111-4111-8111-111111111111";

describe("storage document password protection", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.hashPassword.mockReset();
    mocks.verifyPassword.mockReset();
  });

  it("rejects opening a locked document without the correct password", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: documentId, passwordHash: "$argon2id$hash" }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] });
    mocks.verifyPassword.mockResolvedValue(false);
    await expect(requireStorageDocumentPassword(session, documentId, "")).rejects.toMatchObject({ code: "DOCUMENT_LOCKED", status: 423 });
    expect(mocks.verifyPassword).toHaveBeenCalledWith("", "$argon2id$hash");
  });

  it("limits repeated wrong passwords per user and document", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: documentId, passwordHash: "$argon2id$hash" }] })
      .mockResolvedValueOnce({ rows: [{ count: 8 }] });
    await expect(requireStorageDocumentPassword(session, documentId, "wrong-value")).rejects.toMatchObject({ code: "DOCUMENT_LOCK_RATE_LIMIT", status: 429 });
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });

  it("hashes a new document password before persisting it", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: documentId, passwordHash: null }] })
      .mockResolvedValue({ rows: [] });
    mocks.hashPassword.mockResolvedValue("$argon2id$new-hash");
    await expect(setStorageDocumentPassword(session, documentId, { password: "StrongPassword1!" })).resolves.toEqual({ locked: true });
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO storage_document_locks"),
      [documentId, session.tenantId, "$argon2id$new-hash", session.userId]);
  });
});
