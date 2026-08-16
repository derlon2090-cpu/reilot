import { describe, expect, it, vi } from "vitest";
import {
  buildCampaignCopyMessages,
  generateCampaignCopy,
  validateCampaignCopy
} from "../../src/server/ai/campaign-copy.js";

const session = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
const customInput = {
  title: "إطلاق تحديث تجربة العملاء",
  channel: "email" as const,
  campaignType: "custom" as const,
  mode: "generate" as const,
  tone: "professional" as const,
  language: "auto" as const,
  existingContent: { subject: "", preheader: "", body: "" },
  productIds: []
};
const safeEmailResult = {
  subject: "تجربة أوضح لعملائك",
  preheader: "اكتشف التحسينات الجديدة",
  body: "مرحبًا {{customer_name}}، طوّرنا التجربة لتصبح أكثر وضوحًا وسهولة.",
  ctaText: "اكتشف التحديث",
  usedVariables: ["customer_name"],
  warnings: [],
  summary: "مسودة مهنية واضحة"
};

function dependencies(overrides: Record<string, unknown> = {}) {
  const provider = {
    available: true,
    modelFor: vi.fn(() => "deepseek-v4-flash"),
    completeStructured: vi.fn(async () => ({
      message: { content: JSON.stringify(safeEmailResult) },
      usage: { prompt_tokens: 90, completion_tokens: 70, total_tokens: 160 },
      providerRequestId: "campaign-provider-1"
    }))
  };
  return {
    resolveContext: vi.fn(async () => ({ products: [] })),
    claimGeneration: vi.fn(async () => ({ claimed: true, record: { id: "campaign-generation-1" } })),
    attachResources: vi.fn(async () => undefined),
    completeGeneration: vi.fn(async () => undefined),
    failGeneration: vi.fn(async () => undefined),
    createRun: vi.fn(async () => ({ id: "campaign-run-1" })),
    finishRun: vi.fn(async () => undefined),
    reserve: vi.fn(async () => ({ id: "campaign-reservation-1" })),
    settle: vi.fn(async () => ({ actualTokens: 160 })),
    release: vi.fn(async () => ({ released: true })),
    getUsage: vi.fn(async () => ({ remainingTokens: 1840, nextRefillAt: null })),
    classify: vi.fn(() => ({ modelTier: "flash", thinking: "disabled", reasoningEffort: null })),
    costGuard: vi.fn(async (_session, route) => route),
    createProvider: vi.fn(() => provider),
    provider,
    ...overrides
  };
}

describe("campaign AI copy", () => {
  it.each([
    ["ar", "حملة ترحيبية للعملاء"],
    ["en", "Customer onboarding campaign"],
    ["mixed", "إطلاق Summer collection"]
  ])("keeps %s language guidance and a server-owned variable allowlist", (language, title) => {
    const messages = buildCampaignCopyMessages({ ...customInput, language, title } as typeof customInput);
    const prompt = messages.map((item) => item.content).join("\n");
    expect(prompt).toContain(`اللغة: ${language}`);
    expect(prompt).toContain("{{customer_name}}");
    expect(prompt).toContain("لا تخترع خصمًا");
  });

  it("accepts email fields and approved variables", () => {
    expect(validateCampaignCopy(safeEmailResult, customInput)).toMatchObject({ subject: safeEmailResult.subject, body: safeEmailResult.body });
  });

  it("accepts WhatsApp copy only when email-only fields are empty", () => {
    const input = { ...customInput, channel: "whatsapp" as const };
    const value = { ...safeEmailResult, subject: "", preheader: "", body: "مرحبًا {{customer_name}}، لدينا تحديث جديد.", ctaText: "عرض التفاصيل" };
    expect(validateCampaignCopy(value, input).body).toContain("{{customer_name}}");
    expect(() => validateCampaignCopy({ ...value, subject: "عنوان غير مسموح" }, input)).toThrow(expect.objectContaining({ code: "AI_CAMPAIGN_INVALID_OUTPUT" }));
  });

  it("rejects invented discounts, prices, and unapproved variables", () => {
    expect(() => validateCampaignCopy({ ...safeEmailResult, body: "خصم 25% لك يا {{customer_name}}" }, customInput)).toThrow(expect.objectContaining({ code: "AI_CAMPAIGN_UNSUPPORTED_CLAIM" }));
    expect(() => validateCampaignCopy({ ...safeEmailResult, body: "مرحبًا {{secret_id}}" }, customInput)).toThrow(expect.objectContaining({ code: "AI_CAMPAIGN_UNKNOWN_VARIABLE" }));
  });

  it("requires real tenant products for product campaigns", async () => {
    const deps = dependencies();
    await expect(generateCampaignCopy(session, { ...customInput, campaignType: "product", productIds: [] }, {
      idempotencyKey: "campaign-product-request-0001", dependencies: deps
    })).rejects.toMatchObject({ code: "AI_CAMPAIGN_PRODUCT_REQUIRED" });
    expect(deps.resolveContext).not.toHaveBeenCalled();
  });

  it("reserves estimated usage and settles actual provider usage with its task type", async () => {
    const deps = dependencies();
    const result = await generateCampaignCopy(session, customInput, {
      idempotencyKey: "campaign-copy-request-0001", dependencies: deps
    });
    expect(deps.reserve).toHaveBeenCalledWith(session, expect.objectContaining({ requestedTokens: expect.any(Number), minimumTokens: expect.any(Number) }));
    expect(deps.settle).toHaveBeenCalledWith(session, "campaign-reservation-1", expect.objectContaining({
      taskType: "campaign_copy_generate", aiRunId: "campaign-run-1",
      usage: { prompt_tokens: 90, completion_tokens: 70, total_tokens: 160 }
    }));
    expect(result.quota).toEqual({ charged: 160, remaining: 1840, nextRefillAt: null });
  });

  it("uses a separate task type for regeneration", async () => {
    const deps = dependencies();
    await generateCampaignCopy(session, { ...customInput, mode: "regenerate", existingContent: { subject: "قديم", preheader: "", body: "نص قديم" } }, {
      idempotencyKey: "campaign-copy-regenerate-1", dependencies: deps
    });
    expect(deps.createRun).toHaveBeenCalledWith(session, { taskType: "campaign_copy_regenerate" });
  });

  it("returns an idempotent result without another provider call or charge", async () => {
    const deps = dependencies({ claimGeneration: vi.fn(async () => ({ claimed: false, record: { status: "completed", result: safeEmailResult, charged: 160, remaining: 1840 } })) });
    const result = await generateCampaignCopy(session, customInput, {
      idempotencyKey: "campaign-copy-idempotent-1", dependencies: deps
    });
    expect(result.idempotent).toBe(true);
    expect(deps.reserve).not.toHaveBeenCalled();
    expect(deps.provider.completeStructured).not.toHaveBeenCalled();
  });

  it("releases a reservation if the provider fails before usage is known", async () => {
    const deps = dependencies();
    deps.provider.completeStructured = vi.fn(async () => { throw Object.assign(new Error("down"), { code: "AI_PROVIDER_ERROR", status: 502 }); });
    await expect(generateCampaignCopy(session, customInput, {
      idempotencyKey: "campaign-copy-provider-fail", dependencies: deps
    })).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });
    expect(deps.release).toHaveBeenCalledWith(session, "campaign-reservation-1");
    expect(deps.settle).not.toHaveBeenCalled();
  });
});
