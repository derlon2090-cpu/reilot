import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(), requirePassword: vi.fn(), requireFolder: vi.fn(), getDocument: vi.fn(), updateDocument: vi.fn(), deleteItem: vi.fn()
}));
vi.mock("../../src/server/session.js", () => ({ requireSession: mocks.requireSession }));
vi.mock("../../src/server/campaign-contacts.js", () => ({ sameOriginRequest: () => true }));
vi.mock("../../src/server/storage-schema.js", () => ({ ensureStorageCenterSchema: async () => {} }));
vi.mock("../../src/server/storage-document-locks.js", () => ({ requireStorageDocumentPassword: mocks.requirePassword }));
vi.mock("../../src/server/storage-folder-locks.js", () => ({
  folderPasswordsFromRequest: () => ({}), requireStorageItemFolderAccess: mocks.requireFolder, requireStorageFolderAccess: mocks.requireFolder
}));
vi.mock("../../src/server/storage-center.js", () => ({
  getStorageDocument: mocks.getDocument,
  updateStorageDocument: mocks.updateDocument,
  deleteStorageItem: mocks.deleteItem
}));

import { GET, PATCH } from "../../app/api/storage/documents/[documentId]/route.js";

const documentId = "c1111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ documentId }) };

describe("locked document API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireSession.mockResolvedValue({ ok: true, session: { tenantId: "tenant", userId: "user" } });
    mocks.requireFolder.mockResolvedValue([]);
  });

  it("never reads document content before verifying the file password", async () => {
    mocks.requirePassword.mockRejectedValue(Object.assign(new Error("محمي بكلمة مرور"), { code: "DOCUMENT_LOCKED", status: 423 }));
    const response = await GET(new Request(`https://api.renvix.app/api/storage/documents/${documentId}`), context);
    expect(response.status).toBe(423);
    expect(mocks.getDocument).not.toHaveBeenCalled();
  });

  it("never edits a locked document without the file password", async () => {
    mocks.requirePassword.mockRejectedValue(Object.assign(new Error("محمي بكلمة مرور"), { code: "DOCUMENT_LOCKED", status: 423 }));
    const request = new Request(`https://api.renvix.app/api/storage/documents/${documentId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "changed" })
    });
    const response = await PATCH(request, context);
    expect(response.status).toBe(423);
    expect(mocks.updateDocument).not.toHaveBeenCalled();
  });
});
