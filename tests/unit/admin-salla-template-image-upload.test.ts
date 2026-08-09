import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditMock, deleteMock, putMock, queryMock } = vi.hoisted(() => ({
  auditMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
  queryMock: vi.fn()
}));

vi.mock("@vercel/blob", () => ({ del: deleteMock, put: putMock }));
vi.mock("../../src/server/admin-auth.js", () => ({
  auditAdmin: auditMock,
  requireAdminPermission: vi.fn(async () => ({ ok: true, admin: { adminId: "admin-1", role: "super_admin" } }))
}));
vi.mock("../../src/server/app-url.js", () => ({ appBaseUrl: vi.fn(() => "https://renvix.test") }));
vi.mock("../../src/server/campaign-contacts.js", () => ({ sameOriginRequest: vi.fn(() => true) }));
vi.mock("../../src/server/db.js", () => ({ query: queryMock }));

import { POST } from "../../app/api/admin/integrations/salla/templates/[templateKey]/image/route.js";

const context = { params: Promise.resolve({ templateKey: "review_request" }) };

function imageRequest(bytes: number[], type = "image/png") {
  const data = new FormData();
  data.append("file", new Blob([Uint8Array.from(bytes)], { type }), "review.png");
  return new Request("https://renvix.test/api/admin/integrations/salla/templates/review_request/image", { method: "POST", body: data });
}

describe("admin Salla template WhatsApp image upload", () => {
  beforeEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    auditMock.mockReset().mockResolvedValue(undefined);
    deleteMock.mockReset().mockResolvedValue(undefined);
    putMock.mockReset().mockResolvedValue({ url: "https://assets.blob.vercel-storage.com/platform-review.png" });
    queryMock.mockReset().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
  });

  it("stores a public per-template image in PostgreSQL when Blob is unavailable", async () => {
    const response = await POST(imageRequest([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), context);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.storage).toBe("database");
    expect(payload.imageUrl).toMatch(/^https:\/\/renvix\.test\/api\/public\/platform-salla-template-image\/[0-9a-f-]+\?v=/);
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO platform_salla_template_images"),
      [expect.any(String), "review_request", payload.imageUrl, expect.any(Buffer), "image/png"]
    );
    expect(auditMock).toHaveBeenCalledWith(expect.any(Request), expect.objectContaining({
      action: "admin.salla.default_template.image_updated",
      resource: "review_request"
    }));
  });

  it("rejects spoofed image bytes", async () => {
    const response = await POST(imageRequest([0x00, 0x01, 0x02]), context);
    expect(response.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
  });
});
