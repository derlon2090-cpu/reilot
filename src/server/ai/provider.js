const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_FLASH_MODEL = "deepseek-v4-flash";
const DEFAULT_PRO_MODEL = "deepseek-v4-pro";

export class AIProviderError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
    this.status = status;
  }
}

function providerError(status) {
  if (status === 401) return new AIProviderError("AI_PROVIDER_AUTH_ERROR", "تعذر تشغيل ذكاء Renvix حاليًا.", 503);
  if (status === 402) return new AIProviderError("AI_PROVIDER_BALANCE_ERROR", "تعذر تشغيل ذكاء Renvix حاليًا.", 503);
  if (status === 429) return new AIProviderError("AI_PROVIDER_RATE_LIMIT", "الخدمة مشغولة قليلًا. حاول بعد لحظات.", 429);
  if (status === 408 || status === 504) return new AIProviderError("AI_PROVIDER_TIMEOUT", "استغرق التحليل وقتًا أطول من المعتاد.", 504);
  return new AIProviderError("AI_PROVIDER_ERROR", "تعذر على المساعد إكمال الطلب حاليًا.", 502);
}

function safeToolCalls(message = {}) {
  return Array.isArray(message.tool_calls)
    ? message.tool_calls.filter((item) => item?.type === "function" && item.function?.name)
    : [];
}

function inferenceOptions({ thinking = "disabled", reasoningEffort = null } = {}) {
  const enabled = thinking === "enabled";
  return {
    thinking: { type: enabled ? "enabled" : "disabled" },
    ...(enabled && reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    ...(enabled ? {} : { temperature: 0.2 })
  };
}

export class AIProvider {
  async completeStructured() {
    throw new Error("AIProvider.completeStructured must be implemented");
  }

  async *streamChat() {
    throw new Error("AIProvider.streamChat must be implemented");
  }

  async executeToolLoop({
    messages, tools, executeTool, signal, maxIterations = 4, maxTokens = 900,
    model, thinking = "disabled", reasoningEffort = null
  }) {
    const working = [...messages];
    const executions = [];
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    let remainingOutputTokens = Math.max(128, Number(maxTokens || 900));
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const response = await this.completeStructured({
        messages: working, tools, signal, maxTokens: remainingOutputTokens, model, thinking, reasoningEffort
      });
      const currentUsage = response.usage || {};
      usage = {
        prompt_tokens: Number(usage.prompt_tokens || 0) + Number(currentUsage.prompt_tokens || 0),
        completion_tokens: Number(usage.completion_tokens || 0) + Number(currentUsage.completion_tokens || 0),
        total_tokens: Number(usage.total_tokens || 0) + Number(currentUsage.total_tokens || 0)
      };
      remainingOutputTokens = Math.max(
        0,
        remainingOutputTokens - Number(currentUsage.completion_tokens || 0)
      );
      const assistant = response.message || {};
      const calls = safeToolCalls(assistant);
      if (!calls.length) return { messages: working, executions, usage, finalMessage: assistant };
      working.push({
        role: "assistant",
        content: assistant.content || "",
        ...(assistant.reasoning_content ? { reasoning_content: assistant.reasoning_content } : {}),
        tool_calls: calls
      });
      for (const call of calls) {
        let input = {};
        try { input = JSON.parse(call.function.arguments || "{}"); } catch {
          input = {};
        }
        const result = await executeTool(call.function.name, input);
        executions.push({ name: call.function.name, input, result });
        working.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      if (remainingOutputTokens < 128) break;
    }
    return { messages: working, executions, usage, finalMessage: null };
  }
}

export class DeepSeekProvider extends AIProvider {
  constructor({ apiKey, baseUrl, flashModel, proModel, fetchImpl = fetch } = {}) {
    super();
    this.name = "deepseek";
    this.apiKey = apiKey || process.env.DEEPSEEK_API_KEY || "";
    this.baseUrl = String(baseUrl || process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.models = Object.freeze({
      flash: flashModel || process.env.DEEPSEEK_FLASH_MODEL || DEFAULT_FLASH_MODEL,
      pro: proModel || process.env.DEEPSEEK_PRO_MODEL || DEFAULT_PRO_MODEL
    });
    this.fetchImpl = fetchImpl;
  }

  get available() {
    return Boolean(this.apiKey);
  }

  modelFor(tier = "flash") {
    return tier === "pro" ? this.models.pro : this.models.flash;
  }

  async request(body, signal) {
    if (!this.available) throw new AIProviderError("AI_PROVIDER_DISABLED", "ذكاء Renvix غير مفعّل بعد.", 503);
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new AIProviderError("AI_PROVIDER_TIMEOUT", "تعذر الاتصال بالمساعد حاليًا.", 504);
    }
    if (!response.ok) throw providerError(response.status);
    return response;
  }

  async completeStructured({
    messages, tools = [], signal, maxTokens = 900, model,
    thinking = "disabled", reasoningEffort = null
  }) {
    const thinkingEnabled = thinking === "enabled";
    const response = await this.request({
      model: model || this.modelFor("flash"),
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length && !thinkingEnabled ? "auto" : undefined,
      stream: false,
      ...inferenceOptions({ thinking, reasoningEffort }),
      max_tokens: maxTokens
    }, signal);
    const payload = await response.json();
    return { message: payload.choices?.[0]?.message || {}, usage: payload.usage || {} };
  }

  async *streamChat({
    messages, signal, maxTokens = 1200, model,
    thinking = "disabled", reasoningEffort = null
  }) {
    const response = await this.request({
      model: model || this.modelFor("flash"),
      messages,
      stream: true,
      stream_options: { include_usage: true },
      ...inferenceOptions({ thinking, reasoningEffort }),
      max_tokens: maxTokens
    }, signal);
    const reader = response.body?.getReader();
    if (!reader) throw new AIProviderError("AI_PROVIDER_ERROR", "تعذر بدء الرد المتدفق.", 502);
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let event;
        try { event = JSON.parse(data); } catch { continue; }
        const delta = event.choices?.[0]?.delta || {};
        if (typeof delta.content === "string" && delta.content) yield { type: "text", value: delta.content };
        if (event.usage) yield { type: "usage", value: event.usage };
      }
      if (done) break;
    }
  }
}

export function createAIProvider(options = {}) {
  return new DeepSeekProvider(options);
}
