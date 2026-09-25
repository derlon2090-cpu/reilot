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

import { POST } from "../../app/api/campaigns/assets/route.js";
import { GET } from "../../app/api/public/campaign-image/[imageId]/route.js";

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
    expect(payload.imageUrl).toMatch(/\/api\/public\/campaign-image\/[0-9a-f-]+\?v=/);
    expect(putMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO tenant_campaign_assets"),
      [expect.any(String), "tenant-1", payload.imageUrl, expect.any(Buffer), "image/png", "campaign-card.png", 6, "user-1"]
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
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO tenant_campaign_assets"),
      expect.arrayContaining(["tenant-1", payload.imageUrl, null, null])
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

  it("removes a newly uploaded Blob if the ownership record cannot be saved", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    queryMock.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(POST(imageRequest([0xff, 0xd8, 0xff, 0xdb], "image/jpeg"))).rejects.toThrow("database unavailable");
    expect(deleteMock).toHaveBeenCalledWith("https://assets.blob.vercel-storage.com/campaign.png");
  });

  it("serves a database-backed campaign image with immutable safe headers", async () => {
    queryMock.mockResolvedValueOnce({ rows:[{
      imageData:Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      contentType:"image/png"
    }] });
    const response = await GET(new Request("http://localhost/api/public/campaign-image/11111111-1111-4111-8111-111111111111"), {
      params:Promise.resolve({ imageId:"11111111-1111-4111-8111-111111111111" })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it("does not query storage for an invalid public image id", async () => {
    const response = await GET(new Request("http://localhost/api/public/campaign-image/not-an-id"), {
      params:Promise.resolve({ imageId:"not-an-id" })
    });
    expect(response.status).toBe(404);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
