import { describe, expect, it, vi } from "vitest";
import {
  buildStorageDocumentFormatMessages,
  buildSafeStorageDocumentHtml,
  formatStorageDocumentWithAI,
  sanitizeAIStorageDocumentHtml,
  validateAIStorageDocumentResult
} from "../../src/server/ai/storage-document-format.js";

const session = { tenantId: "tenant-1", userId: "user-1" };

describe("storage document AI formatting", () => {
  it("asks DeepSeek to preserve credentials, remove decorative icons, and separate accounts", () => {
    const prompt = buildStorageDocumentFormatMessages("Netflix user@example.com pass-1234");
    expect(prompt[0].content).toContain("دون تلخيص أو حذف");
    expect(prompt[0].content).toContain("لا تضف أي أيقونات");
    expect(prompt[0].content).toContain("افصل بين الحسابات بعنصر hr");
  });

  it("allows document formatting tags and strips executable markup and event handlers", () => {
    const html = sanitizeAIStorageDocumentHtml('<h2 onclick="steal()">حساب</h2><script>alert(1)</script><p><strong>البريد:</strong> test@example.com</p><img src=x onerror=steal()>');
    expect(html).toBe("<h2>حساب</h2><p><strong>البريد:</strong> test@example.com</p>");
  });

  it("rejects a result that drops an account credential", () => {
    let error;
    try {
      validateAIStorageDocumentResult(
        { html: "<h2>حساب نتفلكس</h2><p>test@example.com</p>" },
        "حساب نتفلكس\ntest@example.com\npassword-9876"
      );
    } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: "AI_STORAGE_SENSITIVE_VALUE_LOST", status: 422 });
  });

  it("builds a safe professional fallback that preserves fields and separates accounts", () => {
    const html = buildSafeStorageDocumentHtml("حساب نتفلكس\nالبريد: user@example.com\nالرمز: 123456\n\nحساب أمازون\nالبريد: shop@example.com\nكلمة المرور: pass-9876");
    expect(html).toContain("<h3>حساب نتفلكس</h3>");
    expect(html).toContain("<strong>البريد:</strong> user@example.com");
    expect(html).toContain("<hr>");
    expect(html).toContain("pass-9876");
  });

  it("uses the safe formatter when the server AI provider is not configured", async () => {
    const createRun = vi.fn(async () => ({ id: "run-fallback-1" }));
    const reserve = vi.fn(async () => ({ id: "reservation-fallback-1" }));
    const settle = vi.fn(async (_session, _reservationId, input) => ({
      actualTokens: Number(input.usage.prompt_tokens) + Number(input.usage.completion_tokens)
    }));
    const result = await formatStorageDocumentWithAI(session, {
      content: "حساب نتفلكس\nالبريد: test@example.com\nالرمز: 123456"
    }, {
      idempotencyKey: "storage-document-fallback-123456",
      dependencies: {
        createProvider: () => ({ available: false }),
        createRun,
        finishRun: vi.fn(async () => null),
        reserve,
        release: vi.fn(async () => null),
        settle,
        getUsage: vi.fn(async () => ({ remainingTokens: 9_740, nextRefillAt: "2026-10-01T00:00:00.000Z" }))
      }
    });
    expect(result).toMatchObject({ ok: true, fallback: true, quota: { charged: expect.any(Number), remaining: 9_740 } });
    expect(result.quota.charged).toBeGreaterThan(0);
    expect(result.html).toContain("test@example.com");
    expect(createRun).toHaveBeenCalledWith(session, { taskType: "storage_document_format" });
    expect(reserve).toHaveBeenCalledWith(session, expect.objectContaining({ requestedTokens: expect.any(Number) }));
    expect(settle).toHaveBeenCalledWith(session, "reservation-fallback-1", expect.objectContaining({
      model: "renvix-safe-formatter-v1",
      routingMode: "flash",
      taskType: "storage_document_format"
    }));
  });

  it("does not return improved text when the shared chat balance cannot be reserved", async () => {
    const settle = vi.fn();
    const finishRun = vi.fn(async () => null);
    const quotaError = Object.assign(new Error("balance exhausted"), {
      code: "AI_PLAN_TOKEN_LIMIT_REACHED",
      status: 429,
      usage: { remainingTokens: 0 }
    });
    await expect(formatStorageDocumentWithAI(session, {
      content: "حساب نتفلكس\nالبريد: test@example.com\nالرمز: 123456"
    }, {
      idempotencyKey: "storage-document-no-balance-123456",
      dependencies: {
        createProvider: () => ({ available: false }),
        createRun: vi.fn(async () => ({ id: "run-no-balance" })),
        finishRun,
        reserve: vi.fn(async () => { throw quotaError; }),
        release: vi.fn(async () => null),
        settle
      }
    })).rejects.toMatchObject({ code: "AI_QUOTA_EXHAUSTED", status: 429 });
    expect(settle).not.toHaveBeenCalled();
    expect(finishRun).toHaveBeenCalledWith(session, "run-no-balance", { status: "failed" });
  });

  it("formats through the server-only provider and settles actual token usage", async () => {
    const provider = {
      available: true,
      modelFor: vi.fn(() => "deepseek-v4-flash"),
      completeStructured: vi.fn(async () => ({
        message: { content: JSON.stringify({ html: "<h2>حساب نتفلكس</h2><p><strong>البريد:</strong> test@example.com</p><p><strong>الرمز:</strong> 123456</p>" }) },
        usage: { prompt_tokens: 100, completion_tokens: 40 },
        providerRequestId: "deepseek-storage-1"
      }))
    };
    const settle = vi.fn(async () => ({ actualTokens: 140 }));
    const result = await formatStorageDocumentWithAI(session, {
      content: "حساب نتفلكس\nالبريد: test@example.com\nالرمز: 123456"
    }, {
      idempotencyKey: "storage-document-test-123456",
      dependencies: {
        createProvider: () => provider,
        createRun: vi.fn(async () => ({ id: "run-1" })),
        finishRun: vi.fn(async () => null),
        reserve: vi.fn(async () => ({ id: "reservation-1" })),
        release: vi.fn(async () => null),
        settle,
        getUsage: vi.fn(async () => ({ remainingTokens: 9_860 }))
      }
    });
    expect(result).toMatchObject({ ok: true, quota: { charged: 140, remaining: 9_860 } });
    expect(result.html).toContain("test@example.com");
    expect(provider.completeStructured).toHaveBeenCalledWith(expect.objectContaining({
      model: "deepseek-v4-flash",
      thinking: "disabled",
      responseFormat: { type: "json_object" }
    }));
    expect(settle).toHaveBeenCalledWith(session, "reservation-1", expect.objectContaining({
      taskType: "storage_document_format",
      providerRequestId: "deepseek-storage-1"
    }));
  });
});
