import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getAccountIntelligence: vi.fn(),
  getAIUsageSummary: vi.fn(),
  getAIUserPreferences: vi.fn(),
  getAIChatStorage: vi.fn()
}));

vi.mock("../../src/server/session.js", () => ({ requireSession: mocks.requireSession }));
vi.mock("../../src/server/ai/account-intelligence.js", () => ({ getAccountIntelligence: mocks.getAccountIntelligence }));
vi.mock("../../src/server/ai/usage.js", () => ({
  getAIUsageSummary: mocks.getAIUsageSummary,
  getAIUserPreferences: mocks.getAIUserPreferences
}));
vi.mock("../../src/server/ai/storage.js", () => ({ getAIChatStorage: mocks.getAIChatStorage }));

import { GET } from "../../app/api/ai/overview/route.js";

describe("AI overview route resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ ok: true, session: { tenantId: "tenant-1", userId: "user-1" } });
    mocks.getAccountIntelligence.mockResolvedValue({ healthScore: 88 });
    mocks.getAIUsageSummary.mockResolvedValue({ allowanceTokens: 100_000, remainingTokens: 100_000 });
    mocks.getAIUserPreferences.mockResolvedValue({ responseStyle: "balanced" });
    mocks.getAIChatStorage.mockResolvedValue({ totalBytes: 0, conversationCount: 0 });
  });

  it("keeps the authoritative new-account balance when optional overview data fails", async () => {
    mocks.getAccountIntelligence.mockRejectedValue(new Error("analytics unavailable"));
    mocks.getAIChatStorage.mockRejectedValue(new Error("storage unavailable"));

    const response = await GET(new Request("https://renvix.app/api/ai/overview"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      usage: { allowanceTokens: 100_000, remainingTokens: 100_000 },
      snapshot: null,
      chatStorage: null,
      warnings: ["snapshot", "chatStorage"]
    });
  });

  it("does not turn a failed balance lookup into a real zero", async () => {
    mocks.getAIUsageSummary.mockRejectedValue(new Error("usage unavailable"));

    const response = await GET(new Request("https://renvix.app/api/ai/overview"));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({ ok: false, code: "AI_USAGE_UNAVAILABLE" });
    expect(payload).not.toHaveProperty("usage.remainingTokens", 0);
  });
});
