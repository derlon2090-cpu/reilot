import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteMock, getTemplateMock, putMock, queryMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  getTemplateMock: vi.fn(),
  putMock: vi.fn(),
  queryMock: vi.fn()
}));

vi.mock("@vercel/blob", () => ({ del: deleteMock, put: putMock }));
vi.mock("../../src/server/campaign-contacts.js", () => ({ sameOriginRequest: vi.fn(() => true) }));
vi.mock("../../src/server/session.js", () => ({
  requireSession: vi.fn(async () => ({
    ok: true,
    session: { tenantId: "tenant-1", userId: "user-1", role: "owner" }
  }))
}));
vi.mock("../../src/server/db.js", () => ({ query: queryMock }));
vi.mock("../../src/server/salla-templates.js", () => ({ getSallaAutomationTemplate: getTemplateMock }));

import { POST } from "../../app/api/apps/salla/templates/[templateKey]/image/route.js";

const context = { params: Promise.resolve({ templateKey: "review_request" }) };

function imageRequest(bytes: number[], type = "image/png") {
  const data = new FormData();
  data.append("file", new Blob([Uint8Array.from(bytes)], { type }), "message-image.png");
  return new Request("http://localhost/api/apps/salla/templates/review_request/image", { method: "POST", body: data });
}

describe("Salla per-template WhatsApp image upload", () => {
  beforeEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    deleteMock.mockReset().mockResolvedValue(undefined);
    putMock.mockReset().mockResolvedValue({ url: "https://assets.blob.vercel-storage.com/salla-review.png" });
    queryMock.mockReset()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    getTemplateMock.mockReset().mockResolvedValue({ available: true, item: { templateKey: "review_request" } });
  });

  it("stores the image independently in PostgreSQL when Blob storage is unavailable", async () => {
    const response = await POST(imageRequest([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), context);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.storage).toBe("database");
    expect(payload.imageUrl).toMatch(/\/api\/public\/salla-template-image\/[0-9a-f-]+\?v=/);
    expect(putMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO tenant_salla_template_images"),
      [expect.any(String), "tenant-1", "review_request", payload.imageUrl, expect.any(Buffer), "image/png"]
    );
  });

  it("uses a dedicated Blob path and never changes the store logo", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const response = await POST(imageRequest([0xff, 0xd8, 0xff, 0xdb], "image/jpeg"), context);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.imageUrl).toBe("https://assets.blob.vercel-storage.com/salla-review.png");
    expect(putMock).toHaveBeenCalledWith(
      expect.stringMatching(/^salla-template-images\/tenant-1\/review_request\/.+\.jpg$/),
      expect.any(Buffer),
      expect.objectContaining({ access: "public", contentType: "image/jpeg" })
    );
    expect(queryMock.mock.calls.flat().join(" ")).not.toContain("order_link_profiles");
  });

  it("rejects spoofed image content before storage", async () => {
    const response = await POST(imageRequest([0x00, 0x01, 0x02]), context);
    expect(response.status).toBe(400);
    expect(putMock).not.toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
  });
});
