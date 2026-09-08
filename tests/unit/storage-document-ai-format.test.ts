import { describe, expect, it, vi } from "vitest";
import {
  buildStorageDocumentFormatMessages,
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
