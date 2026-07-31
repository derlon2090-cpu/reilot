import { beforeEach, describe, expect, it, vi } from "vitest";

const { clientQueryMock, deleteMock, ensureProfileMock, putMock, queryMock, transactionMock } = vi.hoisted(() => ({
  clientQueryMock: vi.fn(),
  deleteMock: vi.fn(),
  ensureProfileMock: vi.fn(),
  putMock: vi.fn(),
  queryMock: vi.fn(),
  transactionMock: vi.fn()
}));

vi.mock("@vercel/blob", () => ({ del: deleteMock, put: putMock }));
vi.mock("../../src/server/session.js", () => ({
  requireSession: vi.fn(async () => ({
    ok: true,
    session: { tenantId: "tenant-1", userId: "user-1", role: "owner" }
  }))
}));
vi.mock("../../src/server/db.js", () => ({ query: queryMock, transaction: transactionMock }));
vi.mock("../../src/server/order-links.js", () => ({ ensureOrderLinkProfile: ensureProfileMock }));

import { POST } from "../../app/api/order-link/profile/logo/route.js";

describe("store logo upload", () => {
  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    deleteMock.mockReset().mockResolvedValue(undefined);
    putMock.mockReset().mockResolvedValue({ url: "https://assets.blob.vercel-storage.com/store-logo.png" });
    queryMock.mockReset().mockResolvedValue({ rows: [] });
    clientQueryMock.mockReset().mockResolvedValue({ rows: [] });
    transactionMock.mockReset().mockImplementation(async (callback) => callback({ query: clientQueryMock }));
    ensureProfileMock.mockReset().mockResolvedValue({
      id: "profile-1",
      slug: "test-store",
      logoUrl: "https://old.blob.vercel-storage.com/old-logo.png"
    });
  });

  it("validates the real image signature, stores it, and updates the shared profile", async () => {
    const data = new FormData();
    data.append("file", new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])], { type: "image/png" }), "store.png");
    const response = await POST(new Request("http://localhost/api/order-link/profile/logo", { method: "POST", body: data }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.logoUrl).toBe("https://assets.blob.vercel-storage.com/store-logo.png");
    expect(putMock).toHaveBeenCalledOnce();
    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("SET logo_url=$1"),
      [payload.logoUrl, null, null, "tenant-1"]
    );
    expect(deleteMock).toHaveBeenCalledWith("https://old.blob.vercel-storage.com/old-logo.png");
  });

  it("stores the image durably in PostgreSQL when managed blob storage is unavailable", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const data = new FormData();
    data.append("file", new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])], { type: "image/png" }), "store.png");

    const response = await POST(new Request("http://localhost/api/order-link/profile/logo", { method: "POST", body: data }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.storage).toBe("database");
    expect(payload.logoUrl).toMatch(/^http:\/\/localhost:3000\/api\/public\/store-logo\/test-store\?v=/);
    expect(putMock).not.toHaveBeenCalled();
    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("logo_data=$2"),
      [payload.logoUrl, expect.any(Buffer), "image/png", "tenant-1"]
    );
  });

  it("rejects a file whose declared type does not match its bytes", async () => {
    const data = new FormData();
    data.append("file", new Blob(["not-a-png"], { type: "image/png" }), "fake.png");
    const response = await POST(new Request("http://localhost/api/order-link/profile/logo", { method: "POST", body: data }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.reason).toBe("invalid_file_type");
    expect(putMock).not.toHaveBeenCalled();
  });

  it("removes the newly uploaded blob when the profile transaction fails", async () => {
    transactionMock.mockRejectedValueOnce(new Error("database unavailable"));
    const data = new FormData();
    data.append("file", new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xdb])], { type: "image/jpeg" }), "store.jpg");

    await expect(POST(new Request("http://localhost/api/order-link/profile/logo", { method: "POST", body: data })))
      .rejects.toThrow("database unavailable");
    expect(deleteMock).toHaveBeenCalledWith("https://assets.blob.vercel-storage.com/store-logo.png");
  });
});
