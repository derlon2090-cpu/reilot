import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteMock, putMock, queryMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  putMock: vi.fn(),
  queryMock: vi.fn()
}));

vi.mock("@vercel/blob", () => ({ del:deleteMock, put:putMock }));
vi.mock("../../src/server/campaign-contacts.js", () => ({ sameOriginRequest:vi.fn(() => true) }));
vi.mock("../../src/server/session.js", () => ({
  requireSession:vi.fn(async () => ({
    ok:true,
    session:{ tenantId:"tenant-1", userId:"user-1", role:"owner" }
  }))
}));
vi.mock("../../src/server/db.js", () => ({ query:queryMock }));

import { DELETE, GET, POST } from "../../app/api/campaigns/assets/route.js";

function imageRequest(bytes: number[], type = "image/png") {
  const data = new FormData();
  data.append("file", new Blob([Uint8Array.from(bytes)], { type }), "campaign-card.png");
  return new Request("http://localhost/api/campaigns/assets", { method:"POST", body:data });
}

describe("campaign image upload", () => {
  beforeEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    deleteMock.mockReset().mockResolvedValue(undefined);
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

  it("uses managed Blob storage when configured and records it in the reusable library", async () => {
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
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO tenant_salla_template_images"),
      [expect.any(String), "tenant-1", expect.stringMatching(/^campaign_asset_[0-9a-f-]+$/), payload.imageUrl, null, null]
    );
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

  it("lists only the tenant campaign image library", async () => {
    queryMock.mockResolvedValueOnce({ rows:[{
      id:"11111111-1111-4111-8111-111111111111",
      imageUrl:"https://renvix.test/api/public/salla-template-image/11111111-1111-4111-8111-111111111111",
      createdAt:"2026-09-25T00:00:00.000Z"
    }] });
    const response = await GET(new Request("http://localhost/api/campaigns/assets"));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.assets).toHaveLength(1);
    expect(payload.assets[0]).toMatchObject({ canDelete:true, name:"صورة حملة 1" });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("template_key LIKE 'campaign_asset"), ["tenant-1"]);
    expect(queryMock.mock.calls[0][0]).not.toContain("LIMIT");
  });

  it("deletes a tenant-owned campaign image and its managed blob", async () => {
    queryMock.mockResolvedValueOnce({ rows:[{ imageUrl:"https://assets.blob.vercel-storage.com/campaign.png" }] });
    const response = await DELETE(new Request("http://localhost/api/campaigns/assets?imageId=11111111-1111-4111-8111-111111111111", { method:"DELETE" }));
    expect(response.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM tenant_salla_template_images"), ["11111111-1111-4111-8111-111111111111", "tenant-1"]);
    expect(deleteMock).toHaveBeenCalledWith("https://assets.blob.vercel-storage.com/campaign.png");
  });
});
