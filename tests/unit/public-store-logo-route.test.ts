import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("../../src/server/db.js", () => ({ query: queryMock }));

import { GET } from "../../app/api/public/store-logo/[storeSlug]/route.js";

describe("public database-backed store logo", () => {
  beforeEach(() => queryMock.mockReset());

  it("serves the validated image with immutable public caching", async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    queryMock.mockResolvedValue({ rows: [{ logoData: bytes, contentType: "image/png", updatedAt: new Date() }] });

    const response = await GET(new Request("https://renvix.app/api/public/store-logo/test-store?v=1"), {
      params: Promise.resolve({ storeSlug: "test-store" })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  });

  it("returns 404 for an invalid slug without querying the database", async () => {
    const response = await GET(new Request("https://renvix.app/api/public/store-logo/invalid!"), {
      params: Promise.resolve({ storeSlug: "invalid!" })
    });

    expect(response.status).toBe(404);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("returns 404 when no durable image exists", async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const response = await GET(new Request("https://renvix.app/api/public/store-logo/test-store"), {
      params: Promise.resolve({ storeSlug: "test-store" })
    });
    expect(response.status).toBe(404);
  });
});
