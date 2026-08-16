import { readFile } from "node:fs/promises";
import { GeminiVisionProvider } from "../src/server/ai/media-providers.js";

if (process.env.RUN_GEMINI_VISION_SMOKE !== "true") {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: "RUN_GEMINI_VISION_SMOKE is not enabled" }));
} else {
  if (!String(process.env.GEMINI_API_KEY || "").trim()) {
    throw new Error("GEMINI_API_KEY is required for the Gemini vision smoke test.");
  }

  const bytes = await readFile(new URL("../tests/fixtures/media-eval/images/01-arabic-interface.png", import.meta.url));
  const provider = new GeminiVisionProvider();
  const estimate = await provider.estimate({ bytes, mimeType: "image/png" });
  const response = await provider.analyzeImage({ bytes, mimeType: "image/png" });

  if (!estimate?.inputTokens || !response.providerRequestId || !response.usageConfirmed || !response.result?.summary) {
    throw new Error("Gemini vision returned an incomplete production response.");
  }

  console.log(JSON.stringify({
    ok: true,
    provider: provider.providerName,
    model: response.model,
    type: response.result.type,
    confidence: response.result.confidence,
    estimatedInputTokens: estimate.inputTokens,
    actualInputTokens: response.usage.inputTokens,
    actualOutputTokens: response.usage.outputTokens,
    mediaResolution: response.mediaResolution,
    providerRequestIdReturned: true
  }));
}
