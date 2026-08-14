import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  readPrivateObject: vi.fn(),
  getAttachmentForUser: vi.fn(),
  getAIUserPreferences: vi.fn(),
  recordAttachmentMetric: vi.fn(),
  createAIRun: vi.fn(),
  reserveProviderQuota: vi.fn(),
  settleProviderUsage: vi.fn(),
  releaseProviderQuota: vi.fn()
}));

vi.mock("../../src/server/db.js", () => ({ query: mocks.query }));
vi.mock("../../src/server/attachments/object-storage.js", () => ({ readPrivateObject: mocks.readPrivateObject }));
vi.mock("../../src/server/attachments/service.js", () => ({ getAttachmentForUser: mocks.getAttachmentForUser }));
vi.mock("../../src/server/ai/usage.js", () => ({ getAIUserPreferences: mocks.getAIUserPreferences }));
vi.mock("../../src/server/attachments/metrics.js", () => ({ recordAttachmentMetric: mocks.recordAttachmentMetric }));
vi.mock("../../src/server/ai/provider-accounting.js", () => ({
  createAIRun: mocks.createAIRun,
  reserveProviderQuota: mocks.reserveProviderQuota,
  settleProviderUsage: mocks.settleProviderUsage,
  releaseProviderQuota: mocks.releaseProviderQuota
}));

import { processAIAttachment } from "../../src/server/ai/media-processing.js";

describe("AI media production gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAttachmentForUser.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      tenantId: "tenant-1",
      userId: "user-1",
      conversationId: "20000000-0000-4000-8000-000000000001",
      messageId: null,
      objectKey: "tenant/image.png",
      originalName: "image.png",
      mimeType: "image/png",
      purpose: "image",
      status: "ready",
      processingStatus: "queued",
      processingGeneration: 1
    });
    mocks.getAIUserPreferences.mockResolvedValue({ imageAnalysisEnabled: true, audioTranscriptionEnabled: true, language: "ar" });
    mocks.readPrivateObject.mockResolvedValue(Buffer.from("same-image-bytes"));
    mocks.recordAttachmentMetric.mockResolvedValue(undefined);
  });

  it("reuses a same-tenant image analysis before any Gemini reservation or provider call", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "10000000-0000-4000-8000-000000000001" }] })
      .mockResolvedValueOnce({ rows: [{
        transcript: null,
        transcript_language: null,
        transcript_confidence: null,
        duration_ms: null,
        transcript_segments: [],
        vision_result: { type: "screenshot", summary: "cached", confidence: 0.95 },
        analysis_provider: "gemini",
        analysis_model: "gemini-3.6-flash"
      }] })
      .mockResolvedValueOnce({ rows: [{
        id: "10000000-0000-4000-8000-000000000001",
        analysis: { type: "screenshot", summary: "cached", confidence: 0.95 },
        processingStatus: "completed",
        status: "processed"
      }] });
    const visionProvider = { providerName: "gemini", model: "gemini-3.6-flash", analyzeImage: vi.fn() };

    await expect(processAIAttachment(
      { tenantId: "tenant-1", userId: "user-1" },
      "10000000-0000-4000-8000-000000000001",
      { visionProvider }
    )).resolves.toMatchObject({ processingStatus: "completed", status: "processed" });

    expect(visionProvider.analyzeImage).not.toHaveBeenCalled();
    expect(mocks.createAIRun).not.toHaveBeenCalled();
    expect(mocks.reserveProviderQuota).not.toHaveBeenCalled();
    expect(mocks.settleProviderUsage).not.toHaveBeenCalled();
    expect(mocks.recordAttachmentMetric).toHaveBeenCalledWith("tenant-1", "media_processing_cache_hit");
  });

  it("requires approved pricing and a logical operation key independent of provider request ids", async () => {
    const [accounting, processing, migration] = await Promise.all([
      readFile("src/server/ai/provider-accounting.js", "utf8"),
      readFile("src/server/ai/media-processing.js", "utf8"),
      readFile("drizzle/0086_ai_provider_idempotency_and_pricing_approval.sql", "utf8")
    ]);
    expect(accounting).toContain("approval_status='approved'");
    expect(accounting).toContain("idempotency_key=$3 OR provider_request_id=$4");
    expect(processing).toContain("media:${attachment.id}:generation:");
    expect(migration).toContain("ai_provider_usage_logical_operation_unique");
    expect(migration).toContain("processing_generation");
    expect(migration).toContain("approval_status='draft'");
    expect(migration).toContain("pricing_version='google-2027-v1'");
  });
});
