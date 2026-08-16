import { describe, expect, it, vi } from "vitest";
import { DeepSeekProvider, deepSeekEnvironmentStatus } from "../../src/server/ai/provider.js";

describe("DeepSeekProvider", () => {
  it("requires the server-only key and rejects public DeepSeek variable names", () => {
    expect(deepSeekEnvironmentStatus({ DEEPSEEK_API_KEY: "server-secret" })).toMatchObject({
      configured: true,
      serverOnly: true,
      missingVariables: [],
      forbiddenPublicVariables: []
    });
    expect(deepSeekEnvironmentStatus({ NEXT_PUBLIC_DEEPSEEK_API_KEY: "public-secret" })).toMatchObject({
      configured: false,
      serverOnly: false,
      missingVariables: ["DEEPSEEK_API_KEY"],
      forbiddenPublicVariables: ["NEXT_PUBLIC_DEEPSEEK_API_KEY"]
    });
  });

  it("keeps the provider contract behind the configured endpoint", async () => {
    const fetchImpl = vi.fn(async (_url, options) => new Response(JSON.stringify({
      choices: [{ message: { role: "assistant", content: "تم" } }],
      usage: { prompt_tokens: 4, completion_tokens: 1 }
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const provider = new DeepSeekProvider({ apiKey: "test-key", baseUrl: "https://ai.example/v1", flashModel: "deepseek-test", fetchImpl });
    const result = await provider.completeStructured({ messages: [{ role: "user", content: "مرحبا" }], model: provider.modelFor("flash"), responseFormat: { type: "json_object" } });
    expect(result.message.content).toBe("تم");
    expect(fetchImpl).toHaveBeenCalledWith("https://ai.example/v1/chat/completions", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toMatchObject({
      model: "deepseek-test",
      stream: false,
      temperature: 0.2,
      thinking: { type: "disabled" }
    });
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("returns the provider request id for accounting correlation", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      id: "deepseek-request-1",
      choices: [{ message: { role: "assistant", content: "OK" } }],
      usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 }
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const provider = new DeepSeekProvider({ apiKey: "test-key", fetchImpl });

    const result = await provider.completeStructured({ messages: [{ role: "user", content: "OK" }] });

    expect(result.providerRequestId).toBe("deepseek-request-1");
  });

  it("parses streamed tokens while ignoring malformed and reasoning-only events", async () => {
    const payload = [
      'data: {"choices":[{"delta":{"reasoning_content":"internal"}}]}',
      'data: malformed',
      'data: {"choices":[{"delta":{"content":"أهلًا "}}]}',
      'data: {"choices":[{"delta":{"content":"بك"}}],"usage":{"completion_tokens":2}}',
      "data: [DONE]",
      ""
    ].join("\n\n");
    const fetchImpl = vi.fn(async () => new Response(payload, { status: 200, headers: { "content-type": "text/event-stream" } }));
    const provider = new DeepSeekProvider({ apiKey: "test-key", fetchImpl });
    const events = [];
    for await (const event of provider.streamChat({ messages: [{ role: "user", content: "مرحبا" }] })) events.push(event);
    expect(events).toEqual([
      { type: "text", value: "أهلًا " },
      { type: "text", value: "بك" },
      { type: "usage", value: { completion_tokens: 2 } }
    ]);
  });

  it("executes allowlisted tool calls before returning control to the orchestrator", async () => {
    const provider = new DeepSeekProvider({ apiKey: "test" });
    provider.completeStructured = vi.fn()
      .mockResolvedValueOnce({ message: { role: "assistant", tool_calls: [{ id: "call-1", type: "function", function: { name: "getAccountHealth", arguments: "{}" } }] } })
      .mockResolvedValueOnce({ message: { role: "assistant", content: "جاهز" } });
    const executeTool = vi.fn(async () => ({ ok: true, data: { healthScore: 90 } }));
    const result = await provider.executeToolLoop({ messages: [{ role: "user", content: "حلل حسابي" }], tools: [], executeTool });
    expect(executeTool).toHaveBeenCalledWith("getAccountHealth", {});
    expect(result.executions).toHaveLength(1);
    expect(result.messages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call-1" });
  });

  it("uses Pro thinking without incompatible sampling or tool-choice fields", async () => {
    const fetchImpl = vi.fn(async (_url, options) => new Response(JSON.stringify({
      choices: [{ message: { role: "assistant", content: "تحليل" } }],
      usage: { prompt_tokens: 7, completion_tokens: 2, total_tokens: 9 }
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const provider = new DeepSeekProvider({ apiKey: "test-key", proModel: "deepseek-v4-pro", fetchImpl });

    await provider.completeStructured({
      messages: [{ role: "user", content: "حلل بعمق" }],
      tools: [{ type: "function", function: { name: "getAccountHealth", parameters: { type: "object" } } }],
      model: provider.modelFor("pro"),
      thinking: "enabled",
      reasoningEffort: "max"
    });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toMatchObject({
      model: "deepseek-v4-pro",
      thinking: { type: "enabled" },
      reasoning_effort: "max"
    });
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("tool_choice");
  });

  it("preserves reasoning content across thinking-mode tool calls", async () => {
    const provider = new DeepSeekProvider({ apiKey: "test" });
    provider.completeStructured = vi.fn()
      .mockResolvedValueOnce({
        message: {
          role: "assistant",
          content: "",
          reasoning_content: "أحتاج بيانات الحساب",
          tool_calls: [{ id: "call-2", type: "function", function: { name: "getAccountHealth", arguments: "{}" } }]
        }
      })
      .mockResolvedValueOnce({ message: { role: "assistant", content: "التحليل النهائي" } });

    const result = await provider.executeToolLoop({
      messages: [{ role: "user", content: "حلل الحساب" }],
      tools: [],
      thinking: "enabled",
      reasoningEffort: "max",
      executeTool: vi.fn(async () => ({ ok: true }))
    });

    expect(result.messages[1]).toMatchObject({
      role: "assistant",
      reasoning_content: "أحتاج بيانات الحساب",
      tool_calls: expect.any(Array)
    });
    expect(result.finalMessage?.content).toBe("التحليل النهائي");
  });
});
