import { describe, expect, it, vi } from "vitest";
import {
  buildStorageDocumentFormatMessages,
  buildSafeStorageDocumentHtml,
  formatStorageDocumentWithAI,
  sanitizeAIStorageDocumentHtml,
  validateAIStorageDocumentResult
} from "../../src/server/ai/storage-document-format.js";

const session = { tenantId: "tenant-1", userId: "user-1" };
const content = "حساب نتفلكس\nالبريد: user@example.com\nكلمة المرور: RiverSecret\nمفتاح الأمان: FalconKey";
const request = { idempotencyKey: "storage-document-test-123456" };

function dependencies(response = { sections: [{ start: 0, end: 4 }] }) {
  const provider = {
    available: true,
    modelFor: vi.fn(() => "deepseek-v4-flash"),
    completeStructured: vi.fn(async () => ({
      message: { content: JSON.stringify(response) },
      usage: { prompt_tokens: 100, completion_tokens: 40 },
      providerRequestId: "deepseek-storage-1"
    }))
  };
  return {
    provider,
    createProvider: () => provider,
    createRun: vi.fn(async () => ({ id: "run-1" })),
    finishRun: vi.fn(async () => null),
    reserve: vi.fn(async () => ({ id: "reservation-1" })),
    release: vi.fn(async () => null),
    settle: vi.fn(async (_session, _reservationId, input) => ({
      actualTokens: Number(input.usage.prompt_tokens) + Number(input.usage.completion_tokens)
    })),
    getUsage: vi.fn(async () => ({ remainingTokens: 9_860 }))
  };
}

describe("storage document AI formatting", () => {
  it("sends only structural descriptors, never raw account credentials", () => {
    const prompt = buildStorageDocumentFormatMessages(content);
    const serialized = JSON.stringify(prompt);
    expect(serialized).toContain("sections");
    expect(serialized).toContain("password");
    for (const secret of ["user@example.com", "RiverSecret", "FalconKey"]) {
      expect(serialized).not.toContain(secret);
    }
    expect(JSON.parse(prompt[1].content)).toHaveLength(4);
  });

  it("strips executable markup from legacy HTML", () => {
    const html = sanitizeAIStorageDocumentHtml('<h2 onclick="steal()">حساب</h2><script>alert(1)</script><p><strong>البريد:</strong> test@example.com</p><img src=x onerror=steal()>');
    expect(html).toBe("<h2>حساب</h2><p><strong>البريد:</strong> test@example.com</p>");
  });

  it("renders original values from a valid section plan", () => {
    const result = validateAIStorageDocumentResult({ sections: [{ start: 0, end: 4 }] }, content);
    expect(result.html).toContain("<strong>البريد:</strong> user@example.com");
    expect(result.html).toContain("RiverSecret");
    expect(result.html).toContain("FalconKey");
  });

  it("rejects gaps, reordered sections, and merged accounts", () => {
    const twoAccounts = `${content}\nحساب أمازون\nالبريد: shop@example.com\nكلمة المرور: SecondSecret`;
    expect(() => validateAIStorageDocumentResult({ sections: [{ start: 1, end: 7 }] }, twoAccounts))
      .toThrow();
    expect(() => validateAIStorageDocumentResult({ sections: [{ start: 0, end: 6 }] }, twoAccounts))
      .toThrow();
    expect(() => validateAIStorageDocumentResult({ sections: [{ start: 0, end: 7 }] }, twoAccounts))
      .toThrow();
    expect(validateAIStorageDocumentResult({ sections: [{ start: 0, end: 4 }, { start: 4, end: 7 }] }, twoAccounts).html)
      .toContain("<hr data-storage-ai-separator>");
  });

  it("separates fifteen adjacent accounts and keeps every credential", () => {
    const input = Array.from({ length: 15 }, (_, index) => `حساب ${index + 1}\nالبريد: user${index + 1}@example.com\nكلمة المرور: pass-${index + 1}\nمفتاح الأمان: key-${index + 1}`).join("\n");
    const html = buildSafeStorageDocumentHtml(input);
    expect((html.match(/<hr data-storage-ai-separator>/g) || [])).toHaveLength(14);
    expect(html).toContain('15.</span> حساب 15</h3>');
    expect(html).toContain('data-storage-ai-number style="color:#087267"');
    for (let index = 1; index <= 15; index++) {
      expect(html).toContain(`user${index}@example.com`);
      expect(html).toContain(`pass-${index}`);
      expect(html).toContain(`key-${index}`);
    }
  });

  it("keeps credentials together despite blank lines and separates completed account groups", () => {
    const input = "حساب أول\n\nEmail: first@example.com\n\nPassword: FirstSecret\n\nSecurity Key: KeyOne\n\nحساب ثاني\n\nEmail: second@example.com\n\nPassword: SecondSecret";
    const html = buildSafeStorageDocumentHtml(input);
    expect((html.match(/<hr data-storage-ai-separator>/g) || [])).toHaveLength(1);
    expect(html).toContain('1.</span> حساب أول');
    expect(html).toContain('2.</span> حساب ثاني');
    expect(html.indexOf("FirstSecret")).toBeLessThan(html.indexOf("<hr data-storage-ai-separator>"));
    expect(html.indexOf("SecondSecret")).toBeGreaterThan(html.indexOf("<hr data-storage-ai-separator>"));
    expect(() => validateAIStorageDocumentResult({ sections: [
      { start: 0, end: 2 }, { start: 2, end: 4 }, { start: 4, end: 7 }
    ] }, input)).toThrow();
  });

  it("uses an editable platform number when the first line was a pasted list item", () => {
    const html = buildSafeStorageDocumentHtml("4. حساب متجر\nEmail: shop@example.com\nPassword: secret");
    expect(html).toContain('<span data-storage-ai-number style="color:#087267">1.</span> حساب متجر');
    expect(html).not.toContain("<hr data-storage-ai-separator>");
  });

  it("splits multiple fields pasted on one line and escapes HTML", () => {
    const html = buildSafeStorageDocumentHtml("حساب أول\nالبريد: first@example.com كلمة المرور: <secret> مفتاح الأمان: 12345");
    expect(html).toContain("<strong>البريد:</strong> first@example.com");
    expect(html).toContain("<strong>كلمة المرور:</strong> &lt;secret&gt;");
    expect(html).toContain("<strong>مفتاح الأمان:</strong> 12345");
  });

  it("charges and immediately returns the balance for local formatting", async () => {
    const deps = dependencies();
    const result = await formatStorageDocumentWithAI(session, { content }, {
      ...request,
      dependencies: { ...deps, createProvider: () => ({ available: false }) }
    });
    expect(result).toMatchObject({ ok: true, fallback: true, quota: { charged: expect.any(Number), remaining: 9_860 } });
    expect(result.quota.charged).toBeGreaterThan(0);
    expect(result.html).toContain("RiverSecret");
    expect(deps.createRun).toHaveBeenCalledOnce();
    expect(deps.reserve).toHaveBeenCalledOnce();
    expect(deps.settle).toHaveBeenCalledWith(session, "reservation-1", expect.objectContaining({
      provider: "renvix", model: "renvix-local-formatter", taskType: "storage_document_format"
    }));
  });

  it("keeps the quota error when AI balance cannot be reserved", async () => {
    const deps = dependencies();
    deps.reserve.mockRejectedValueOnce(Object.assign(new Error("balance exhausted"), {
      code: "AI_PLAN_TOKEN_LIMIT_REACHED", status: 429, usage: { remainingTokens: 0 }
    }));
    await expect(formatStorageDocumentWithAI(session, { content }, { ...request, dependencies: deps }))
      .rejects.toMatchObject({ code: "AI_QUOTA_EXHAUSTED", status: 429 });
    expect(deps.settle).not.toHaveBeenCalled();
    expect(deps.finishRun).toHaveBeenCalledWith(session, "run-1", { status: "failed" });
  });

  it("charges actual token usage for a valid AI section plan", async () => {
    const deps = dependencies();
    const result = await formatStorageDocumentWithAI(session, { content }, { ...request, dependencies: deps });
    expect(result).toMatchObject({ ok: true, quota: { charged: 140, remaining: 9_860 } });
    expect(result.html).toContain("FalconKey");
    expect(deps.provider.completeStructured).toHaveBeenCalledWith(expect.objectContaining({
      model: "deepseek-v4-flash", responseFormat: { type: "json_object" }
    }));
    expect(deps.settle).toHaveBeenCalledWith(session, "reservation-1", expect.objectContaining({
      taskType: "storage_document_format", providerRequestId: "deepseek-storage-1"
    }));
  });

  it("charges provider usage and formats locally when AI returns an unsafe plan", async () => {
    const deps = dependencies({ sections: [{ start: 0, end: 2 }] });
    const result = await formatStorageDocumentWithAI(session, { content }, { ...request, dependencies: deps });
    expect(result).toMatchObject({ ok: true, fallback: true, quota: { charged: 140 } });
    expect(result.html).toContain("RiverSecret");
    expect(deps.release).not.toHaveBeenCalled();
    expect(deps.settle).toHaveBeenCalledWith(session, "reservation-1", expect.objectContaining({
      provider: "deepseek", providerRequestId: "deepseek-storage-1"
    }));
  });

  it("does not show a successful formatting result when settlement fails", async () => {
    const deps = dependencies();
    deps.settle.mockRejectedValueOnce(Object.assign(new Error("database unavailable"), { status: 503 }));
    await expect(formatStorageDocumentWithAI(session, { content }, { ...request, dependencies: deps }))
      .rejects.toThrow("database unavailable");
    expect(deps.release).toHaveBeenCalledWith(session, "reservation-1");
  });

  it("does not charge an aborted formatting request", async () => {
    const deps = dependencies();
    deps.provider.completeStructured.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));
    await expect(formatStorageDocumentWithAI(session, { content }, { ...request, dependencies: deps }))
      .rejects.toThrow("aborted");
    expect(deps.release).toHaveBeenCalledWith(session, "reservation-1");
    expect(deps.settle).not.toHaveBeenCalled();
  });
});
