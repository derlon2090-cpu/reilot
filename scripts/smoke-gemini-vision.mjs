import { readFile } from "node:fs/promises";
import { GeminiVisionProvider } from "../src/server/ai/media-providers.js";

if (!String(process.env.GEMINI_API_KEY || "").trim()) {
  throw new Error("GEMINI_API_KEY is required for the Gemini vision smoke test.");
}

const bytes = await readFile(new URL("../tests/fixtures/media-eval/images/01-arabic-interface.png", import.meta.url));
const provider = new GeminiVisionProvider();
const estimate = await provider.estimate({ bytes, mimeType: "image/png" });
let response;
try {
  response = await provider.analyzeImage({ bytes, mimeType: "image/png" });
} catch (providerFailure) {
  const image = { type: "image", data: bytes.toString("base64"), mime_type: "image/png" };
  const base = {
    model: provider.model,
    input: [{ type: "text", text: "Return only the word OK." }, image]
  };
  const cases = [
    ["minimal-image", base],
    ["with-resolution", { ...base, input: [base.input[0], { ...image, resolution: "medium" }] }],
    ["structured-simple", {
      ...base,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          properties: { summary: { type: "string" } },
          required: ["summary"],
          additionalProperties: false
        }
      }
    }],
    ["max-output", { ...base, generation_config: { max_output_tokens: 32 } }],
    ["thinking-low", { ...base, generation_config: { max_output_tokens: 32, thinking_level: "low" } }]
  ];
  for (const [name, request] of cases) {
    try {
      const diagnostic = await provider.client.interactions.create(request);
      console.log(JSON.stringify({ diagnostic: name, ok: true, idReturned: Boolean(diagnostic.id) }));
    } catch (error) {
      console.log(JSON.stringify({
        diagnostic: name,
        ok: false,
        status: Number(error?.status || error?.statusCode || 0),
        code: String(error?.error?.error?.code || error?.error?.code || "")
      }));
    }
  }
  throw providerFailure;
}

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
