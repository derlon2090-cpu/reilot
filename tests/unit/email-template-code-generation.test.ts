import { describe, expect, it, vi } from "vitest";
import {
  buildEmailTemplateCodeMessages,
  EMAIL_TEMPLATE_ALLOWED_VARIABLES,
  generateEmailTemplateCode,
  validateGeneratedEmailTemplate
} from "../../src/server/ai/email-template-code.js";

const session = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
const input = {
  prompt: "أنشئ رسالة تجديد أنيقة مع زر واضح",
  mode: "generate" as const,
  templateContext: { templateType: "renewal" as const, channel: "email" as const },
  selectedTemplateColor: "#087F75"
};
const safeResult = {
  html: '<table role="presentation" width="100%" dir="rtl" style="background-color:#f4f9f8"><tbody><tr><td style="padding:24px;text-align:right"><h2 style="color:#087f75">مرحبًا {{customer_name}}</h2><p>ينتهي اشتراك {{service_name}} في {{expiry_date}}</p><a href="{{renewal_url}}" style="background-color:#087f75;color:#ffffff;padding:12px;text-decoration:none">جدد الآن</a></td></tr></tbody></table>',
  usedVariables: ["customer_name", "service_name", "expiry_date", "renewal_url"],
  warnings: []
};

function dependencies(overrides: Record<string, unknown> = {}) {
  const provider = {
    available: true,
    modelFor: vi.fn(() => "deepseek-v4-flash"),
    completeStructured: vi.fn(async () => ({
      message: { content: JSON.stringify(safeResult) },
      usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
      providerRequestId: "provider-email-1"
    }))
  };
  return {
    claimGeneration: vi.fn(async () => ({ claimed: true, record: { id: "generation-1" } })),
    attachGenerationResources: vi.fn(async () => undefined),
    completeGeneration: vi.fn(async () => undefined),
    failGeneration: vi.fn(async () => undefined),
    createRun: vi.fn(async () => ({ id: "run-1" })),
    finishRun: vi.fn(async () => undefined),
    reserve: vi.fn(async () => ({ id: "reservation-1" })),
    settle: vi.fn(async () => ({ actualTokens: 200 })),
    release: vi.fn(async () => ({ released: true })),
    getUsage: vi.fn(async () => ({ remainingTokens: 4800, nextRefillAt: "2026-08-20T00:00:00.000Z" })),
    classify: vi.fn(() => ({ modelTier: "flash", thinking: "disabled", reasoningEffort: null, complexityScore: 18 })),
    costGuard: vi.fn(async (_session, route) => route),
    createProvider: vi.fn(() => provider),
    provider,
    ...overrides
  };
}

describe("renewal email AI code generation", () => {
  it("builds a server-side Arabic, RTL, email-safe prompt with only the approved variables and selected color", () => {
    const messages = buildEmailTemplateCodeMessages(input);
    const combined = messages.map((item) => item.content).join("\n");
    expect(combined).toContain("RTL");
    expect(combined).toContain("LTR للإنجليزية");
    expect(combined).toContain("#087F75");
    for (const variable of EMAIL_TEMPLATE_ALLOWED_VARIABLES) expect(combined).toContain(`{{${variable}}}`);
    expect(combined).toContain("ممنوع JavaScript");
  });

  it("accepts safe HTML, derives variables from the sanitized source, and strips unsafe event attributes", () => {
    const result = validateGeneratedEmailTemplate({
      html: '<div dir="rtl" onmouseover="alert(1)"><a href="{{renewal_url}}">مرحبًا {{customer_name}}</a></div>',
      usedVariables: [],
      warnings: []
    });
    expect(result.html).not.toContain("onmouseover");
    expect(result.usedVariables).toEqual(["renewal_url", "customer_name"]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it.each([
    ["active script", { html: "<script>alert(1)</script>", usedVariables: [], warnings: [] }, "AI_EMAIL_UNSAFE_OUTPUT"],
    ["invalid structured shape", { html: 123, usedVariables: "customer_name", warnings: [] }, "AI_EMAIL_INVALID_OUTPUT"],
    ["unknown variable", { html: "<p>{{secret_customer_id}}</p>", usedVariables: [], warnings: [] }, "AI_EMAIL_UNKNOWN_VARIABLE"],
    ["unapproved image", { html: '<img src="https://example.com/invented.png" alt="image">', usedVariables: [], warnings: [] }, "AI_EMAIL_UNAPPROVED_IMAGE"],
    ["oversized html", { html: `<p>${"x".repeat(30001)}</p>`, usedVariables: [], warnings: [] }, "AI_EMAIL_INVALID_OUTPUT"]
  ])("rejects %s", (_label, value, code) => {
    expect(() => validateGeneratedEmailTemplate(value)).toThrow(expect.objectContaining({ code }));
  });

  it("keeps an already-approved image when editing existing sanitized HTML", () => {
    const html = '<div dir="ltr"><img src="https://assets.renvix.app/logo.png" alt="Renvix"><p>Hello {{customer_name}}</p></div>';
    expect(validateGeneratedEmailTemplate({ html, usedVariables: [], warnings: [] }, {
      allowedImageSources: ["https://assets.renvix.app/logo.png"]
    }).html).toContain("https://assets.renvix.app/logo.png");
  });

  it("removes javascript and data:text/html URLs from otherwise safe markup", () => {
    const result = validateGeneratedEmailTemplate({
      html: '<div dir="rtl"><a href="javascript:alert(1)">رابط</a><a href="data:text/html;base64,PHNjcmlwdD4=">آخر</a></div>',
      usedVariables: [],
      warnings: []
    });
    expect(result.html).not.toMatch(/javascript:|data:text\/html/i);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("supports English requests while preserving the language and direction rules in the server prompt", () => {
    const messages = buildEmailTemplateCodeMessages({ ...input, prompt: "Create a clean English renewal email" });
    const combined = messages.map((item) => item.content).join("\n");
    expect(combined).toContain("Create a clean English renewal email");
    expect(combined).toContain("LTR للإنجليزية");
  });

  it("reserves the estimated maximum and settles only the provider's actual usage with task metadata", async () => {
    const deps = dependencies();
    const result = await generateEmailTemplateCode(session, input, {
      idempotencyKey: "email-template-request-0001",
      dependencies: deps
    });
    expect(deps.reserve).toHaveBeenCalledWith(session, expect.objectContaining({ requestedTokens: expect.any(Number), minimumTokens: expect.any(Number) }));
    const reserveCalls = vi.mocked(deps.reserve).mock.calls as unknown as Array<[unknown, { requestedTokens: number; minimumTokens: number }]>;
    const reservationInput = reserveCalls[0][1];
    expect(reservationInput.minimumTokens).toBe(reservationInput.requestedTokens);
    expect(deps.settle).toHaveBeenCalledWith(session, "reservation-1", expect.objectContaining({
      usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
      taskType: "email_template_code_generation",
      aiRunId: "run-1",
      processingLatencyMs: expect.any(Number)
    }));
    expect(result.quota).toEqual({ charged: 200, remaining: 4800, nextRefillAt: "2026-08-20T00:00:00.000Z" });
    expect(deps.release).not.toHaveBeenCalled();
  });

  it("returns a completed idempotent result without a second provider call or charge", async () => {
    const deps = dependencies({ claimGeneration: vi.fn(async () => ({ claimed: false, record: {
      status: "completed", html: safeResult.html, usedVariables: safeResult.usedVariables,
      warnings: [], charged: 200, remaining: 4800, nextRefillAt: null
    } })) });
    const result = await generateEmailTemplateCode(session, input, {
      idempotencyKey: "email-template-request-0002",
      dependencies: deps
    });
    expect(result.idempotent).toBe(true);
    expect(deps.createProvider).not.toHaveBeenCalled();
    expect(deps.reserve).not.toHaveBeenCalled();
  });

  it("routes existing-code edits as email_template_code_edit and preserves the current sanitized HTML in context", async () => {
    const deps = dependencies();
    const existingHtml = '<div dir="rtl"><p>مرحبًا {{customer_name}}</p></div>';
    await generateEmailTemplateCode(session, { ...input, mode: "edit", existingHtml, prompt: "اجعل العنوان أهدأ" }, {
      idempotencyKey: "email-template-edit-0001",
      dependencies: deps
    });
    expect(deps.createRun).toHaveBeenCalledWith(session, { taskType: "email_template_code_edit" });
    expect(deps.settle).toHaveBeenCalledWith(session, "reservation-1", expect.objectContaining({ taskType: "email_template_code_edit" }));
    const providerCalls = vi.mocked(deps.provider.completeStructured).mock.calls as unknown as Array<[{ messages: Array<{ content: string }> }]>;
    const providerInput = providerCalls[0][0];
    expect(providerInput.messages.map((item) => item.content).join("\n")).toContain(existingHtml);
  });

  it("rejects an oversized request before claiming, reserving, or calling DeepSeek", async () => {
    const deps = dependencies();
    await expect(generateEmailTemplateCode(session, { ...input, prompt: "x".repeat(2001) }, {
      idempotencyKey: "email-template-oversized-1",
      dependencies: deps
    })).rejects.toMatchObject({ code: "AI_EMAIL_INVALID_REQUEST", status: 400 });
    expect(deps.claimGeneration).not.toHaveBeenCalled();
    expect(deps.reserve).not.toHaveBeenCalled();
    expect(deps.provider.completeStructured).not.toHaveBeenCalled();
  });

  it("allows only one provider execution when concurrent requests share an idempotency key", async () => {
    let firstClaimed = false;
    let continueProvider!: () => void;
    const providerGate = new Promise<void>((resolve) => { continueProvider = resolve; });
    const deps = dependencies({
      claimGeneration: vi.fn(async () => {
        if (!firstClaimed) {
          firstClaimed = true;
          return { claimed: true, record: { id: "generation-concurrent" } };
        }
        return { claimed: false, record: { id: "generation-concurrent", status: "processing" } };
      })
    });
    deps.provider.completeStructured = vi.fn(async () => {
      await providerGate;
      return {
        message: { content: JSON.stringify(safeResult) },
        usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
        providerRequestId: "provider-concurrent-1"
      };
    });
    const first = generateEmailTemplateCode(session, input, {
      idempotencyKey: "email-template-concurrent-1", dependencies: deps
    });
    await vi.waitFor(() => expect(deps.provider.completeStructured).toHaveBeenCalledTimes(1));
    await expect(generateEmailTemplateCode(session, input, {
      idempotencyKey: "email-template-concurrent-1", dependencies: deps
    })).rejects.toMatchObject({ code: "AI_EMAIL_REQUEST_IN_PROGRESS", status: 409 });
    continueProvider();
    await expect(first).resolves.toMatchObject({ ok: true });
    expect(deps.provider.completeStructured).toHaveBeenCalledTimes(1);
    expect(deps.reserve).toHaveBeenCalledTimes(1);
    expect(deps.settle).toHaveBeenCalledTimes(1);
  });

  it("releases the reservation and marks the run failed when the provider fails before reporting usage", async () => {
    const deps = dependencies();
    deps.provider.completeStructured = vi.fn(async () => { throw Object.assign(new Error("provider unavailable"), { code: "AI_PROVIDER_ERROR", status: 502 }); });
    await expect(generateEmailTemplateCode(session, input, {
      idempotencyKey: "email-template-request-0003", dependencies: deps
    })).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });
    expect(deps.release).toHaveBeenCalledWith(session, "reservation-1");
    expect(deps.finishRun).toHaveBeenCalledWith(session, "run-1", { status: "failed" });
    expect(deps.settle).not.toHaveBeenCalled();
  });

  it("charges actual provider usage but rejects an invalid structured response", async () => {
    const deps = dependencies();
    deps.provider.completeStructured = vi.fn(async () => ({
      message: { content: JSON.stringify({ html: "<script>alert(1)</script>", usedVariables: [], warnings: [] }) },
      usage: { prompt_tokens: 40, completion_tokens: 10, total_tokens: 50 },
      providerRequestId: "provider-invalid-1"
    }));
    await expect(generateEmailTemplateCode(session, input, {
      idempotencyKey: "email-template-request-0004", dependencies: deps
    })).rejects.toMatchObject({ code: "AI_EMAIL_UNSAFE_OUTPUT", charged: 200 });
    expect(deps.settle).toHaveBeenCalledTimes(1);
    expect(deps.release).not.toHaveBeenCalled();
    expect(deps.finishRun).toHaveBeenCalledWith(session, "run-1", { status: "failed" });
  });

  it("fails closed on exhausted quota before calling the provider", async () => {
    const quotaError = Object.assign(new Error("لا يوجد رصيد"), { code: "AI_PLAN_TOKEN_LIMIT_REACHED", status: 429, usage: { remainingTokens: 0 } });
    const deps = dependencies({ reserve: vi.fn(async () => { throw quotaError; }) });
    await expect(generateEmailTemplateCode(session, input, {
      idempotencyKey: "email-template-request-0005", dependencies: deps
    })).rejects.toMatchObject({ code: "AI_QUOTA_EXHAUSTED", status: 429 });
    expect(deps.provider.completeStructured).not.toHaveBeenCalled();
    expect(deps.settle).not.toHaveBeenCalled();
  });
});
