import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getAIUsageSummary: vi.fn(),
  getAIUserPreferences: vi.fn(),
  getAIChatStorageSummary: vi.fn()
}));

vi.mock("../../src/server/session.js", () => ({ requireSession: mocks.requireSession }));
vi.mock("../../src/server/ai/usage.js", () => ({
  getAIUsageSummary: mocks.getAIUsageSummary,
  getAIUserPreferences: mocks.getAIUserPreferences
}));
vi.mock("../../src/server/ai/storage.js", () => ({ getAIChatStorageSummary: mocks.getAIChatStorageSummary }));

import { GET as getOverview } from "../../app/api/ai/overview/route.js";
import { GET as getUsage } from "../../app/api/ai/usage/route.js";

describe("AI overview route resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ ok: true, session: { tenantId: "tenant-1", userId: "user-1" } });
    mocks.getAIUsageSummary.mockResolvedValue({ allowanceTokens: 100_000, remainingTokens: 100_000 });
    mocks.getAIUserPreferences.mockResolvedValue({ responseStyle: "balanced" });
    mocks.getAIChatStorageSummary.mockResolvedValue({ totalBytes: 0, conversationCount: 0 });
  });

  it("keeps the authoritative new-account balance when optional overview data fails", async () => {
    mocks.getAIChatStorageSummary.mockRejectedValue(new Error("storage unavailable"));

    const response = await getOverview(new Request("https://renvix.app/api/ai/overview"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      usage: { allowanceTokens: 100_000, remainingTokens: 100_000 },
      snapshot: null,
      chatStorage: null,
      warnings: ["chatStorage"]
    });
  });

  it("does not turn a failed balance lookup into a real zero", async () => {
    mocks.getAIUsageSummary.mockRejectedValue(new Error("usage unavailable"));

    const response = await getOverview(new Request("https://renvix.app/api/ai/overview"));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({ ok: false, code: "AI_USAGE_UNAVAILABLE" });
    expect(payload).not.toHaveProperty("usage.remainingTokens", 0);
  });

  it("preserves a permanent inactive-entitlement response instead of retrying it as an outage", async () => {
    mocks.getAIUsageSummary.mockRejectedValue(Object.assign(new Error("لا يوجد اشتراك نشط يمنح رصيد الذكاء حاليًا."), {
      code: "AI_ENTITLEMENT_INACTIVE", status: 403
    }));

    const response = await getOverview(new Request("https://renvix.app/api/ai/overview"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ ok: false, code: "AI_ENTITLEMENT_INACTIVE" });
  });

  it("serves the balance through a dedicated fast path without starting optional analytics or storage work", async () => {
    const response = await getUsage(new Request("https://renvix.app/api/ai/usage"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toMatchObject({ usage: { allowanceTokens: 100_000, remainingTokens: 100_000 } });
    expect(mocks.getAIUserPreferences).not.toHaveBeenCalled();
    expect(mocks.getAIChatStorageSummary).not.toHaveBeenCalled();
  });
});
