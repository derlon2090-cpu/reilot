import { DeepSeekProvider, deepSeekEnvironmentStatus } from "../src/server/ai/provider.js";

function fail(code, message) {
  process.stderr.write(`${JSON.stringify({ ok: false, code, message })}\n`);
  process.exitCode = 1;
}

const environment = deepSeekEnvironmentStatus();
if (environment.forbiddenPublicVariables.length) {
  fail("AI_PROVIDER_PUBLIC_SECRET_FORBIDDEN", "A public DeepSeek environment variable is configured. Remove it and keep DEEPSEEK_API_KEY server-side only.");
} else if (!environment.configured) {
  fail("AI_PROVIDER_DISABLED", "DEEPSEEK_API_KEY is missing from this server environment.");
} else {
  const provider = new DeepSeekProvider();
  const startedAt = Date.now();
  try {
    const result = await provider.completeStructured({
      model: provider.modelFor("flash"),
      messages: [{ role: "user", content: "Respond only with: OK" }],
      maxTokens: 8,
      thinking: "disabled"
    });
    const responseText = String(result.message?.content || "").trim();
    const usage = result.usage || {};
    const inputTokens = Number(usage.prompt_tokens || 0);
    const outputTokens = Number(usage.completion_tokens || 0);
    const totalTokens = Number(usage.total_tokens || inputTokens + outputTokens);
    const providerRequestIdReturned = Boolean(String(result.providerRequestId || ""));
    if (responseText !== "OK" || inputTokens <= 0 || outputTokens <= 0 || totalTokens <= 0 || !providerRequestIdReturned) {
      fail("AI_SMOKE_INVALID_RESPONSE", "DeepSeek responded, but the expected OK response or usage counters were missing.");
    } else {
      process.stdout.write(`${JSON.stringify({
        ok: true,
        provider: "deepseek",
        model: provider.modelFor("flash"),
        response: "OK",
        usage: { inputTokens, outputTokens, totalTokens },
        providerRequestIdReturned,
        latencyMs: Date.now() - startedAt
      })}\n`);
    }
  } catch (error) {
    fail(error?.code || "AI_SMOKE_FAILED", "DeepSeek smoke test failed. Check the server-side key, provider balance, model access, and outbound network connectivity.");
  }
}
