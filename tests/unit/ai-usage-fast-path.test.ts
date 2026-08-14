import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAIEntitlementSnapshot: vi.fn(),
  getAIEntitlementSummary: vi.fn()
}));

vi.mock("../../src/server/ai/entitlements.js", () => mocks);

import { getAIUsageSummary } from "../../src/server/ai/usage.js";

describe("AI usage fast path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serves an existing entitlement without starting the locking materialization path", async () => {
    const snapshot = { allowanceTokens: 100_000, remainingTokens: 87_500 };
    mocks.getAIEntitlementSnapshot.mockResolvedValue(snapshot);

    await expect(getAIUsageSummary({ tenantId: "tenant-1" })).resolves.toBe(snapshot);
    expect(mocks.getAIEntitlementSummary).not.toHaveBeenCalled();
  });

  it("provisions a new account only when no entitlement snapshot exists", async () => {
    const provisioned = { allowanceTokens: 100_000, remainingTokens: 100_000 };
    mocks.getAIEntitlementSnapshot.mockResolvedValue(null);
    mocks.getAIEntitlementSummary.mockResolvedValue(provisioned);

    await expect(getAIUsageSummary({ tenantId: "tenant-new" })).resolves.toBe(provisioned);
    expect(mocks.getAIEntitlementSummary).toHaveBeenCalledTimes(1);
  });
});
