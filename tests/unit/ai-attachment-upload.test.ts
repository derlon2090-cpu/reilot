import { beforeEach, describe, expect, it, vi } from "vitest";

const { createUploadMock, completeMock, inspectMock } = vi.hoisted(() => ({
  createUploadMock: vi.fn(),
  completeMock: vi.fn(),
  inspectMock: vi.fn()
}));

vi.mock("../../src/server/session.js", () => ({
  requireSession: vi.fn(async () => ({ ok: true, session: { tenantId: "tenant-1", userId: "user-1" } }))
}));
vi.mock("../../src/server/campaign-contacts.js", () => ({ sameOriginRequest: vi.fn(() => true) }));
vi.mock("../../src/server/attachments/service.js", () => ({
  createAttachmentUpload: createUploadMock,
  completeAttachmentUpload: completeMock
}));
vi.mock("../../src/server/attachments/object-storage.js", () => ({ inspectPrivateObject: inspectMock }));

import { POST as prepareUpload } from "../../app/api/ai/conversations/[conversationId]/attachments/route.js";
import { POST as completeUpload } from "../../app/api/ai/attachments/[attachmentId]/complete/route.js";

describe("private AI conversation attachment upload", () => {
  beforeEach(() => {
    createUploadMock.mockReset().mockResolvedValue({
      attachment: { id: "attachment-1", name: "chat.png", type: "image/png", size: 842000, status: "uploading" },
      upload: { method: "PUT", url: "https://signed-r2.test/upload", headers: { "Content-Type": "image/png" }, expiresAt: "2026-08-13T20:00:00Z" }
    });
    completeMock.mockReset().mockResolvedValue({ id: "attachment-1", status: "ready", processingStatus: "queued" });
  });

  it("returns an object-specific short-lived direct upload without credentials", async () => {
    const request = new Request("https://renvix.test/api/ai/conversations/conversation-1/attachments", {
      method: "POST",
      headers: { origin: "https://renvix.test", "content-type": "application/json" },
      body: JSON.stringify({ name: "chat.png", mimeType: "image/png", size: 842000 })
    });
    const response = await prepareUpload(request, { params: Promise.resolve({ conversationId: "conversation-1" }) });
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(createUploadMock).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-1", userId: "user-1" }), {
      conversationId: "conversation-1", name: "chat.png", mimeType: "image/png", size: 842000, durationMs: undefined
    });
    expect(payload.upload).toMatchObject({ method: "PUT", headers: { "Content-Type": "image/png" } });
    expect(JSON.stringify(payload)).not.toMatch(/secret|accessKey|credential/i);
  });

  it("uses an idempotent complete endpoint backed by server-side verification", async () => {
    const request = new Request("https://renvix.test/api/ai/attachments/attachment-1/complete", {
      method: "POST", headers: { origin: "https://renvix.test" }
    });
    const response = await completeUpload(request, { params: Promise.resolve({ attachmentId: "attachment-1" }) });
    expect(response.status).toBe(200);
    expect(completeMock).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-1" }), "attachment-1");
    await expect(response.json()).resolves.toMatchObject({ attachment: { status: "ready" } });
  });
});
