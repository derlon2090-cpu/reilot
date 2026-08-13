const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";

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

export class AIProvider {
  async completeStructured() {
    throw new Error("AIProvider.completeStructured must be implemented");
  }

  async *streamChat() {
    throw new Error("AIProvider.streamChat must be implemented");
  }

  async executeToolLoop({ messages, tools, executeTool, signal, maxIterations = 4, maxTokens = 900 }) {
    const working = [...messages];
    const executions = [];
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const response = await this.completeStructured({ messages: working, tools, signal, maxTokens });
      const currentUsage = response.usage || {};
      usage = {
        prompt_tokens: Number(usage.prompt_tokens || 0) + Number(currentUsage.prompt_tokens || 0),
        completion_tokens: Number(usage.completion_tokens || 0) + Number(currentUsage.completion_tokens || 0),
        total_tokens: Number(usage.total_tokens || 0) + Number(currentUsage.total_tokens || 0)
      };
      const assistant = response.message || {};
      const calls = safeToolCalls(assistant);
      if (!calls.length) return { messages: working, executions, usage };
      working.push({ role: "assistant", content: assistant.content || "", tool_calls: calls });
      for (const call of calls) {
        let input = {};
        try { input = JSON.parse(call.function.arguments || "{}"); } catch {
          input = {};
        }
        const result = await executeTool(call.function.name, input);
        executions.push({ name: call.function.name, input, result });
        working.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    return { messages: working, executions, usage };
  }
}

export class DeepSeekProvider extends AIProvider {
  constructor({ apiKey, baseUrl, model, fetchImpl = fetch } = {}) {
    super();
    this.apiKey = apiKey || process.env.DEEPSEEK_API_KEY || "";
    this.baseUrl = String(baseUrl || process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.model = model || process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;
    this.fetchImpl = fetchImpl;
  }

  get available() {
    return Boolean(this.apiKey);
  }

  async request(body, signal) {
    if (!this.available) throw new AIProviderError("AI_PROVIDER_DISABLED", "ذكاء Renvix غير مفعّل بعد.", 503);
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, ...body }),
        signal
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new AIProviderError("AI_PROVIDER_TIMEOUT", "تعذر الاتصال بالمساعد حاليًا.", 504);
    }
    if (!response.ok) throw providerError(response.status);
    return response;
  }

  async completeStructured({ messages, tools = [], signal, maxTokens = 900 }) {
    const response = await this.request({
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? "auto" : undefined,
      stream: false,
      temperature: 0.2,
      max_tokens: maxTokens
    }, signal);
    const payload = await response.json();
    return { message: payload.choices?.[0]?.message || {}, usage: payload.usage || {} };
  }

  async *streamChat({ messages, signal, maxTokens = 1200 }) {
    const response = await this.request({ messages, stream: true, stream_options: { include_usage: true }, temperature: 0.2, max_tokens: maxTokens }, signal);
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
