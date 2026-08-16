import { describe, expect, it, vi } from "vitest";
import {
  DeepgramSpeechProvider,
  GeminiAudioFallbackProvider,
  GeminiVisionProvider,
  SpeechQualityEvaluator,
  VisionResultSchema,
  deepgramKeyterms,
  deepgramLanguage,
  selectGeminiMediaResolution
} from "../../src/server/ai/media-providers.js";
import {
  calculateProviderCost,
  normalizeDeepgramUsage,
  normalizeGeminiUsage,
  quotaUnitsForCost
} from "../../src/server/ai/provider-accounting.js";

function png(width = 800, height = 600) {
  const bytes = Buffer.alloc(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

describe("production media provider contracts", () => {
  it("uses strict Gemini JSON and retries only one invalid schema response", async () => {
    const createInteraction = vi.fn()
      .mockResolvedValueOnce({ output_text: "not-json", usage: { total_tokens: 12 }, id: "first" })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({ type: "screenshot", summary: "لوحة تحكم", confidence: 0.95 }),
        usage: {
          total_input_tokens: 260,
          total_output_tokens: 40,
          total_tokens: 300,
          input_tokens_by_modality: [{ modality: "image", tokens: 256 }]
        },
        id: "gemini-request-2", model: "gemini-3.6-flash"
      });
    const provider = new GeminiVisionProvider({
      model: "gemini-3.6-flash",
      client: { interactions: { create: createInteraction } }
    });
    const response = await provider.analyzeImage({ bytes: png(), mimeType: "image/png" });
    expect(createInteraction).toHaveBeenCalledTimes(2);
    expect(response.result).toMatchObject({ type: "screenshot", summary: "لوحة تحكم", confidence: 0.95 });
    expect(response.usage).toMatchObject({ inputTokens: 260, outputTokens: 40, totalTokens: 300, imageInputTokens: 256 });
    const request = createInteraction.mock.calls[0][0];
    expect(request.response_format).toMatchObject({ type: "text", mime_type: "application/json" });
    expect(request.response_format.schema.additionalProperties).toBe(false);
    expect(JSON.stringify(request.response_format.schema)).not.toMatch(/"(?:default|minLength|maxLength)"/);
    expect(JSON.stringify(request.response_format.schema)).not.toContain('"anyOf"');
    expect(request.response_format.schema.properties.tables.items.properties).toHaveProperty("markdown");
    expect(request.input[1]).toMatchObject({ type: "image", mime_type: "image/png", resolution: "medium" });
    expect(request.input[1].data).toBeTypeOf("string");
    expect(request.generation_config).toEqual({ max_output_tokens: 2_000, thinking_level: "low" });
  });

  it("rejects unexpected fields and chooses high resolution only for large dense images", () => {
    expect(VisionResultSchema.safeParse({ type: "photo", summary: "ok", confidence: 1, injected: true }).success).toBe(false);
    expect(selectGeminiMediaResolution(png(800, 600), "image/png")).toContain("MEDIUM");
    expect(selectGeminiMediaResolution(png(2600, 1800), "image/png")).toContain("HIGH");
  });

  it("retries only explicit transient Gemini failures", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const generateContent = vi.fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          transcript: "تأكد إذا WhatsApp API connected أو لا",
          language: "mixed",
          preservedTerms: ["WhatsApp", "API", "connected"],
          confidence: 0.91
        }),
        usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30, totalTokenCount: 150 },
        responseId: "gemini-audio-2"
      });
    const provider = new GeminiAudioFallbackProvider({
      client: { models: { generateContent } }, retryDelay: wait
    });

    const response = await provider.transcribe({
      bytes: Buffer.from("audio"), mimeType: "audio/wav", requiredTerms: ["WhatsApp", "API"]
    });

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({ language: "mixed", usageConfirmed: true, providerRequestId: "gemini-audio-2" });
  });

  it("does not retry a non-transient Gemini client error", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const generateContent = vi.fn().mockRejectedValue({ status: 400 });
    const provider = new GeminiAudioFallbackProvider({
      client: { models: { generateContent } }, retryDelay: wait
    });

    await expect(provider.transcribe({ bytes: Buffer.from("audio"), mimeType: "audio/wav" }))
      .rejects.toMatchObject({ code: "AUDIO_FALLBACK_FAILED" });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("uses Nova-3 Arabic locale, smart formatting, keyterm, and provider duration", async () => {
    const transcribeFile = vi.fn().mockResolvedValue({
      metadata: { request_id: "dg-request-1", duration: 4.25, channels: 1 },
      results: { channels: [{ alternatives: [{
        transcript: "افتح Renvix و WhatsApp",
        confidence: 0.93,
        words: [{ word: "Renvix", start: 0.5, end: 1, confidence: 0.96 }]
      }] }] }
    });
    const provider = new DeepgramSpeechProvider({
      model: "nova-3", client: { listen: { v1: { media: { transcribeFile } } } }
    });
    const response = await provider.transcribe({ bytes: Buffer.from("audio"), locale: "ar", dynamicTerms: ["Order 42", "bad:semicolon"] });
    const options = transcribeFile.mock.calls[0][1];
    expect(options).toMatchObject({ model: "nova-3", language: "ar-SA", smart_format: true, mip_opt_out: true });
    expect(options.keyterm).toContain("Renvix");
    expect(options.keyterm).toContain("Order 42");
    expect(options).not.toHaveProperty("keywords");
    expect(response).toMatchObject({ durationMs: 4250, providerRequestId: "dg-request-1", confidence: 0.93 });
  });

  it("does not select multi blindly and bounds dynamic keyterms", () => {
    expect(deepgramLanguage("ar-EG")).toBe("ar-SA");
    expect(deepgramLanguage("en-GB")).toBe("en-US");
    const terms = deepgramKeyterms(Array.from({ length: 30 }, (_, index) => `Term ${index}`));
    expect(terms.length).toBeLessThanOrEqual(50);
    expect(terms).toContain("Gemini");
  });

  it("triggers fallback criteria for low confidence and missing required mixed terms", () => {
    const evaluator = new SpeechQualityEvaluator({ minimumConfidence: 0.8 });
    expect(evaluator.evaluate({ text: "افتح المتجر", confidence: 0.92, words: [] }).acceptable).toBe(true);
    const poor = evaluator.evaluate({ text: "افتح المتجر", confidence: 0.4, words: [] }, { requiredTerms: ["Webhook"] });
    expect(poor.acceptable).toBe(false);
    expect(poor.reasons).toEqual(expect.arrayContaining(["low_confidence", "required_mixed_terms_missing"]));
  });
});

describe("provider-native accounting", () => {
  it("normalizes actual Gemini usage metadata, including thought and cached tokens", () => {
    expect(normalizeGeminiUsage({
      promptTokenCount: 300, candidatesTokenCount: 80, thoughtsTokenCount: 20,
      cachedContentTokenCount: 50, totalTokenCount: 400,
      promptTokensDetails: [{ modality: "IMAGE", tokenCount: 256 }]
    })).toMatchObject({ inputTokens: 300, outputTokens: 80, thoughtTokens: 20, cachedTokens: 50, totalTokens: 400, imageInputTokens: 256 });
  });

  it("normalizes Interactions API usage and its image modality breakdown", () => {
    expect(normalizeGeminiUsage({
      total_input_tokens: 310,
      total_output_tokens: 90,
      total_thought_tokens: 25,
      total_cached_tokens: 40,
      total_tokens: 425,
      input_tokens_by_modality: [{ modality: "image", tokens: 280 }, { modality: "text", tokens: 30 }]
    })).toEqual({
      inputTokens: 310,
      outputTokens: 90,
      thoughtTokens: 25,
      cachedTokens: 40,
      totalTokens: 425,
      imageInputTokens: 280,
      textInputTokens: 30
    });
  });

  it("calculates Deepgram by actual seconds times channels and keyterm add-on", () => {
    const usage = normalizeDeepgramUsage({ metadata: { request_id: "dg", duration: 30, channels: 2 } }, {
      model: "nova-3", language: "ar-SA", keyterm: ["Renvix"]
    });
    const cost = calculateProviderCost("deepgram", usage, [
      { usageType: "audio_second", nativeUnit: "second", pricePerUnitUsd: 0.000128333333, pricingVersion: "v1", variant: "mip_opt_out" },
      { usageType: "keyterm_audio_second", nativeUnit: "second", pricePerUnitUsd: 0.000021666667, pricingVersion: "v1", variant: "mip_opt_out" }
    ]);
    expect(cost.components[0].nativeAmount).toBe(60);
    expect(cost.actualCostUsd).toBeCloseTo(0.009, 8);
    expect(quotaUnitsForCost(cost.actualCostUsd, 0.000001)).toBe(9000);
  });

  it("calculates Gemini input, output, and thought prices without treating estimates as actual", () => {
    const cost = calculateProviderCost("gemini", {
      inputTokens: 1_000, cachedTokens: 200, outputTokens: 100, thoughtTokens: 50
    }, [
      { usageType: "input_token", nativeUnit: "token", pricePerUnitUsd: 0.00000075, pricingVersion: "2026-h2", variant: "standard" },
      { usageType: "cached_input_token", nativeUnit: "token", pricePerUnitUsd: 0.000000075, pricingVersion: "2026-h2", variant: "standard" },
      { usageType: "output_token", nativeUnit: "token", pricePerUnitUsd: 0.00000375, pricingVersion: "2026-h2", variant: "standard" },
      { usageType: "thought_token", nativeUnit: "token", pricePerUnitUsd: 0.00000375, pricingVersion: "2026-h2", variant: "standard" }
    ]);
    expect(cost.actualCostUsd).toBeCloseTo(0.0011775, 10);
  });
});
