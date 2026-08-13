import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteMock, putMock, getConversationMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  putMock: vi.fn(),
  getConversationMock: vi.fn()
}));

vi.mock("@vercel/blob", () => ({ del: deleteMock, put: putMock }));
vi.mock("../../src/server/session.js", () => ({
  requireSession: vi.fn(async () => ({ ok: true, session: { tenantId: "tenant-1", userId: "user-1" } }))
}));
vi.mock("../../src/server/campaign-contacts.js", () => ({ sameOriginRequest: vi.fn(() => true) }));
vi.mock("../../src/server/ai/conversations.js", () => ({ getAIConversation: getConversationMock }));
vi.mock("../../src/server/tenant-storage.js", () => ({
  getTenantStorageLimitState: vi.fn(async () => ({ isUnlimited: false, remainingBytes: 20 * 1024 * 1024 }))
}));

import { POST } from "../../app/api/ai/conversations/[conversationId]/attachments/route.js";

const context = { params: Promise.resolve({ conversationId: "conversation-1" }) };

function uploadRequest(bytes: number[], type = "image/png", name = "chat.png") {
  const data = new FormData();
  data.append("files", new Blob([Uint8Array.from(bytes)], { type }), name);
  return new Request("https://renvix.test/api/ai/conversations/conversation-1/attachments", {
    method: "POST", headers: { origin: "https://renvix.test" }, body: data
  });
}

describe("AI conversation attachments", () => {
  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    deleteMock.mockReset().mockResolvedValue(undefined);
    putMock.mockReset().mockResolvedValue({ url: "https://assets.test/chat.png" });
    getConversationMock.mockReset().mockResolvedValue({ id: "conversation-1" });
  });

  it("stores a validated attachment under the authenticated tenant and user path", async () => {
    const response = await POST(uploadRequest([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), context);
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.items[0]).toEqual(expect.objectContaining({ name: "chat.png", type: "image/png", size: 6 }));
    expect(payload.items[0].path).toMatch(/^ai\/tenant-1\/user-1\/conversation-1\/[0-9a-f-]+\.png$/);
    expect(putMock).toHaveBeenCalledWith(payload.items[0].path, expect.any(Buffer), expect.objectContaining({ access: "public", contentType: "image/png" }));
  });

  it("rejects spoofed image content before storage", async () => {
    const response = await POST(uploadRequest([0x00, 0x01, 0x02]), context);
    expect(response.status).toBe(400);
    expect(putMock).not.toHaveBeenCalled();
  });
});
