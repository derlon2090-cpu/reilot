import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, writeMock, inspectMock, prefixMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  writeMock: vi.fn(),
  inspectMock: vi.fn(),
  prefixMock: vi.fn()
}));

vi.mock("../../src/server/db.js", () => ({
  query: queryMock,
  transaction: vi.fn()
}));
vi.mock("../../src/server/tenant-storage.js", () => ({
  getTenantStorageLimitState: vi.fn(),
  reconcileTenantStorageUsage: vi.fn()
}));
vi.mock("../../src/server/attachments/metrics.js", () => ({ recordAttachmentMetric: vi.fn(async () => {}) }));
vi.mock("../../src/server/attachments/object-storage.js", () => ({
  createPrivateDownload: vi.fn(),
  createPrivateUpload: vi.fn(),
  deletePrivateObject: vi.fn(),
  deletePrivateObjectsAndVerify: vi.fn(),
  inspectPrivateObject: inspectMock,
  readPrivateObjectPrefix: prefixMock,
  writePrivateObject: writeMock
}));

import { uploadAttachmentBytes } from "../../src/server/attachments/service.js";

const session = { tenantId: "tenant-1", userId: "user-1" };
const row = {
  id: "28d08f50-236c-4f50-86e0-0ff2efad463b",
  conversationId: "conversation-1",
  messageId: null,
  objectKey: "production/chat/tenant-1/conversation-1/28d08f50-236c-4f50-86e0-0ff2efad463b.webm",
  originalName: "voice.webm",
  mimeType: "audio/webm",
  sizeBytes: 4,
  purpose: "audio",
  status: "uploading",
  processingStatus: "pending",
  durationMs: 1200,
  transcript: "",
  transcriptConfidence: null,
  visionResult: null,
  processingGeneration: 0,
  createdAt: new Date("2026-08-14T10:00:00Z")
};

describe("authenticated AI attachment relay service", () => {
  beforeEach(() => {
    queryMock.mockReset().mockImplementation(async (sql: string, params: unknown[]) => {
      expect(params.slice(0, 3)).toEqual([row.id, session.tenantId, session.userId]);
      if (sql.includes("UPDATE ai_attachments")) return { rows: [{ ...row, status: "ready", processingStatus: "queued" }] };
      return { rows: [row] };
    });
    writeMock.mockReset().mockResolvedValue(undefined);
    inspectMock.mockReset().mockResolvedValue({ size: 4, contentType: "audio/webm", etag: "etag-1" });
    prefixMock.mockReset().mockResolvedValue(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  });

  it("writes only the tenant-scoped pending object then performs normal verification", async () => {
    const body = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
    const attachment = await uploadAttachmentBytes(session, row.id, body, "audio/webm");
    expect(writeMock).toHaveBeenCalledWith({ objectKey: row.objectKey, contentType: "audio/webm", body });
    expect(inspectMock).toHaveBeenCalledWith(row.objectKey);
    expect(attachment).toMatchObject({ id: row.id, status: "ready", processingStatus: "queued" });
  });

  it("rejects size or MIME mismatches before any R2 write", async () => {
    await expect(uploadAttachmentBytes(session, row.id, Buffer.from([1]), "audio/webm")).rejects.toMatchObject({ code: "UPLOAD_SIZE_MISMATCH" });
    await expect(uploadAttachmentBytes(session, row.id, Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), "audio/ogg")).rejects.toMatchObject({ code: "UPLOAD_MIME_MISMATCH" });
    expect(writeMock).not.toHaveBeenCalled();
  });
});
