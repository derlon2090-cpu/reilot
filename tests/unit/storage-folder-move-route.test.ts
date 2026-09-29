import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), requireItem: vi.fn(), requireFolder: vi.fn(), moveItem: vi.fn() }));
vi.mock("../../src/server/session.js", () => ({ requireSession: mocks.requireSession }));
vi.mock("../../src/server/campaign-contacts.js", () => ({ sameOriginRequest: () => true }));
vi.mock("../../src/server/storage-schema.js", () => ({ ensureStorageCenterSchema: async () => {} }));
vi.mock("../../src/server/storage-folder-locks.js", () => ({
  folderPasswordsFromRequest: () => ({}), requireStorageItemAccess: mocks.requireItem, requireStorageFolderAccess: mocks.requireFolder
}));
vi.mock("../../src/server/storage-center.js", () => ({ moveStorageItem: mocks.moveItem }));

import { POST } from "../../app/api/storage/items/[itemId]/move/route.js";

describe("locked storage folder moves", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireSession.mockResolvedValue({ ok: true, session: { tenantId: "tenant", userId: "user" } });
  });

  it("blocks moving a document out of a locked folder before mutation", async () => {
    mocks.requireItem.mockRejectedValue(Object.assign(new Error("محمي بكلمة مرور"), { code: "FOLDER_LOCKED", status: 423 }));
    const request = new Request("https://api.renvix.app/api/storage/items/document/move", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "document", folderId: null })
    });
    const response = await POST(request, { params: Promise.resolve({ itemId: "document" }) });
    expect(response.status).toBe(423);
    expect(mocks.moveItem).not.toHaveBeenCalled();
  });
});
