import { beforeEach, describe, expect, it, vi } from "vitest";

const { putMock, queryMock } = vi.hoisted(() => ({
  putMock: vi.fn(),
  queryMock: vi.fn()
}));

vi.mock("@vercel/blob", () => ({ put:putMock }));
vi.mock("../../src/server/campaign-contacts.js", () => ({ sameOriginRequest:vi.fn(() => true) }));
vi.mock("../../src/server/session.js", () => ({
  requireSession:vi.fn(async () => ({
    ok:true,
    session:{ tenantId:"tenant-1", userId:"user-1", role:"owner" }
  }))
}));
vi.mock("../../src/server/db.js", () => ({ query:queryMock }));

import { POST } from "../../app/api/campaigns/assets/route.js";

function imageRequest(bytes: number[], type = "image/png") {
  const data = new FormData();
  data.append("file", new Blob([Uint8Array.from(bytes)], { type }), "campaign-card.png");
  return new Request("http://localhost/api/campaigns/assets", { method:"POST", body:data });
}

describe("campaign image upload", () => {
  beforeEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    putMock.mockReset().mockResolvedValue({ url:"https://assets.blob.vercel-storage.com/campaign.png" });
    queryMock.mockReset().mockResolvedValue({ rows:[] });
  });

  it("stores a durable database-backed image when Blob is not configured", async () => {
    const response = await POST(imageRequest([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.storage).toBe("database");
    expect(payload.imageUrl).toMatch(/\/api\/public\/salla-template-image\/[0-9a-f-]+\?v=/);
    expect(putMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO tenant_salla_template_images"),
      [expect.any(String), "tenant-1", expect.stringMatching(/^campaign_asset_[0-9a-f-]+$/), payload.imageUrl, expect.any(Buffer), "image/png"]
    );
  });

  it("uses managed Blob storage when configured while recording ownership", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const response = await POST(imageRequest([0xff, 0xd8, 0xff, 0xdb], "image/jpeg"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.storage).toBe("vercel_blob");
    expect(payload.imageUrl).toBe("https://assets.blob.vercel-storage.com/campaign.png");
    expect(putMock).toHaveBeenCalledWith(
      expect.stringMatching(/^campaign-assets\/tenant-1\/.+\.jpg$/),
      expect.any(Buffer),
      expect.objectContaining({ access:"public", contentType:"image/jpeg" })
    );
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("rejects a spoofed image before writing storage", async () => {
    const response = await POST(imageRequest([0x00, 0x01, 0x02]));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.reason).toBe("invalid_file_type");
    expect(putMock).not.toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("surfaces a database failure without pretending that the image was stored", async () => {
    queryMock.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(POST(imageRequest([0x89, 0x50, 0x4e, 0x47], "image/png"))).rejects.toThrow("database unavailable");
    expect(putMock).not.toHaveBeenCalled();
  });
});
