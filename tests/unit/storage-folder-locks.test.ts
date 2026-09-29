import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), hashPassword: vi.fn(), verifyPassword: vi.fn() }));
vi.mock("../../src/server/db.js", () => ({ query: mocks.query }));
vi.mock("../../src/server/password.js", () => ({ hashPassword: mocks.hashPassword, verifyPassword: mocks.verifyPassword }));

import { folderPasswordsFromRequest, requireStorageFolderAccess, setStorageFolderPassword } from "../../src/server/storage-folder-locks.js";

const session = { tenantId: "a1111111-1111-4111-8111-111111111111", userId: "b1111111-1111-4111-8111-111111111111" };
const parentId = "c1111111-1111-4111-8111-111111111111";
const childId = "d1111111-1111-4111-8111-111111111111";

describe("storage folder password protection", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.hashPassword.mockReset();
    mocks.verifyPassword.mockReset();
  });

  it("requires the parent password before entering a child folder", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: parentId, passwordHash: "parent-hash" }, { id: childId, passwordHash: null }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] });
    mocks.verifyPassword.mockResolvedValue(false);
    await expect(requireStorageFolderAccess(session, childId, {})).rejects.toMatchObject({ code: "FOLDER_LOCKED", folderId: parentId, status: 423 });
  });

  it("unlocks an ancestor only with its own password", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: parentId, passwordHash: "parent-hash" }, { id: childId, passwordHash: null }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] });
    mocks.verifyPassword.mockResolvedValue(true);
    await expect(requireStorageFolderAccess(session, childId, { [parentId]: "StrongPassword1!" })).resolves.toEqual([parentId]);
    expect(mocks.verifyPassword).toHaveBeenCalledWith("StrongPassword1!", "parent-hash");
  });

  it("hashes folder passwords and rejects system folders", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: parentId, isSystem: false, passwordHash: null }] }).mockResolvedValue({ rows: [] });
    mocks.hashPassword.mockResolvedValue("$argon2id$folder-hash");
    await expect(setStorageFolderPassword(session, parentId, { password: "StrongPassword1!" })).resolves.toEqual({ locked: true });
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO storage_folder_locks"),
      [parentId, session.tenantId, "$argon2id$folder-hash", session.userId]);
    mocks.query.mockReset().mockResolvedValueOnce({ rows: [{ id: parentId, isSystem: true, passwordHash: null }] });
    await expect(setStorageFolderPassword(session, parentId, { password: "StrongPassword1!" })).rejects.toMatchObject({ code: "SYSTEM_FOLDER_IMMUTABLE" });
  });

  it("ignores malformed password headers", () => {
    expect(folderPasswordsFromRequest(new Request("https://example.com", { headers: { "X-Storage-Folder-Passwords": "not-json" } }))).toEqual({});
  });

  it("decodes Unicode folder passwords from the ASCII-safe header", () => {
    const passwords = { [parentId]: "مجلد آمن 🔐 123" };
    const encoded = Buffer.from(JSON.stringify(passwords), "utf8").toString("base64url");
    const request = new Request("https://example.com", { headers: { "X-Storage-Folder-Passwords-B64": encoded } });
    expect(folderPasswordsFromRequest(request)).toEqual(passwords);
  });
});
