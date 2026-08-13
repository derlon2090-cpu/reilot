import { describe, expect, it } from "vitest";
import {
  aiToolDefinitions,
  chooseAccountTools,
  executeAIReadTool,
  toolsToUIBlocks
} from "../../src/server/ai/tools.js";

const snapshot = {
  period: "last_30_days",
  scores: { healthScore: 88, growthScore: 76 },
  metrics: {
    subscriptionsTotal: 127,
    activeSubscriptions: 108,
    renewedCurrent: 24,
    failedRenewals: 3,
    upcomingRenewals: 12,
    renewalSuccessRate: 89,
    renewalRevenue: 28540,
    renewalChange: 8,
    revenueChange: 11,
    connectedChannels: 2,
    unhealthyChannels: 0,
    messagesTotal: 600,
    deliveredMessages: 582,
    failedMessages: 18,
    deliveryRate: 97,
    campaignsTotal: 4,
    campaignDelivered: 420,
    campaignFailed: 8,
    campaignSuccessRate: 98,
    openTickets: 2,
    ticketsNeedReply: 1
  },
  risks: [{ title: "3 تجديدات تحتاج المتابعة" }],
  opportunities: [{ title: "تحسين حملة الاستعادة" }],
  recommendations: [{ title: "راجع التجديدات المتعثرة" }],
  plan: { name: "الأعمال", periodEnd: "2026-09-01" }
};

describe("Renvix account intelligence tools", () => {
  it("exposes only the allowlisted read-only tools", () => {
    const names = aiToolDefinitions().map((item) => item.function.name);
    expect(names).toEqual([
      "getAccountHealth",
      "getRenewalAnalytics",
      "getChannelHealth",
      "getCampaignPerformance",
      "getPlanUsage",
      "getSupportHistory",
      "getGrowthOpportunities"
    ]);
  });

  it("selects account tools from Arabic intent without adding a write action", () => {
    const names = chooseAccountTools("حلل تجديدات العملاء وإيرادات الاشتراكات");
    expect(names).toContain("getAccountHealth");
    expect(names).toContain("getRenewalAnalytics");
    expect(names.every((name) => name.startsWith("get"))).toBe(true);
  });

  it("returns tenant-scoped snapshot values and rejects unknown tools", () => {
    const session = { role: "owner", tenantId: "tenant-a", userId: "user-a" };
    const result = executeAIReadTool(session, snapshot, "getRenewalAnalytics", {});
    expect(result).toMatchObject({ ok: true, source: "renvix_account_data" });
    expect(result.data).toMatchObject({ totalSubscriptions: 127, revenue: 28540 });
    expect(() => executeAIReadTool(session, snapshot, "deleteCustomer", {})).toThrow("AI_TOOL_NOT_ALLOWED");
  });

  it("validates tool arguments and maps results to bounded UI blocks", () => {
    const session = { role: "viewer", tenantId: "tenant-a", userId: "user-a" };
    expect(() => executeAIReadTool(session, snapshot, "getRenewalAnalytics", { from: "not-a-date" })).toThrow();
    const executions = [
      { name: "getAccountHealth", result: executeAIReadTool(session, snapshot, "getAccountHealth", {}) },
      { name: "getRenewalAnalytics", result: executeAIReadTool(session, snapshot, "getRenewalAnalytics", {}) },
      { name: "getChannelHealth", result: executeAIReadTool(session, snapshot, "getChannelHealth", {}) },
      { name: "getCampaignPerformance", result: executeAIReadTool(session, snapshot, "getCampaignPerformance", {}) }
    ];
    expect(toolsToUIBlocks(executions)).toHaveLength(3);
    expect(toolsToUIBlocks(executions).map((block) => block.type)).toEqual([
      "account_health", "renewal_summary", "channel_status"
    ]);
  });
});
