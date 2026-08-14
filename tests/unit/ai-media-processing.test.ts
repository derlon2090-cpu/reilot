import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  OpenAICompatibleSpeechProvider,
  OpenAICompatibleVisionProvider
} from "../../src/server/ai/media-processing.js";
import { redactAISecrets, sanitizeAIContext } from "../../src/server/ai/privacy.js";

describe("AI media adapters", () => {
  it("transcribes Arabic-first audio behind a replaceable speech contract", async () => {
    const fetchImpl = vi.fn(async (_url: string, _options: RequestInit) => Response.json({
      text: "افحص طلب Salla رقم 42",
      language: "ar",
      confidence: 0.91,
      duration: 2.4,
      segments: [{ start: 0, end: 2.4, text: "افحص طلب Salla رقم 42" }]
    }));
    const provider = new OpenAICompatibleSpeechProvider({
      apiKey: "speech-key", endpoint: "https://speech.test/transcriptions", model: "arabic-stt", fetchImpl
    });
    const result = await provider.transcribe({
      bytes: Buffer.from("audio"), mimeType: "audio/webm", filename: "voice.webm", durationMs: 2300
    });
    expect(result).toMatchObject({ text: "افحص طلب Salla رقم 42", language: "ar", confidence: 0.91, durationMs: 2400 });
    const request = fetchImpl.mock.calls[0][1];
    expect(request.body).toBeInstanceOf(FormData);
    const form = request.body as FormData;
    expect(form.get("language")).toBe("ar");
    expect(form.get("prompt")).toContain("WhatsApp");
  });

  it("returns structured Vision JSON and never calls the DeepSeek endpoint", async () => {
    const fetchImpl = vi.fn(async (_url: string, _options: RequestInit) => Response.json({
      choices: [{ message: { content: JSON.stringify({
        type: "dashboard_screenshot", summary: "لوحة تجديدات", metrics: [{ name: "renewal_rate", value: 87, unit: "%" }], confidence: 0.94
      }) } }]
    }));
    const provider = new OpenAICompatibleVisionProvider({
      apiKey: "vision-key", endpoint: "https://vision.test/chat/completions", model: "vision-model", fetchImpl
    });
    const result = await provider.analyzeImage({ bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]), mimeType: "image/png" });
    expect(result).toMatchObject({ type: "dashboard_screenshot", confidence: 0.94 });
    expect(fetchImpl.mock.calls[0][0]).toBe("https://vision.test/chat/completions");
    expect(fetchImpl.mock.calls[0][0]).not.toContain("deepseek");
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body.messages[0].content[1].type).toBe("image_url");
  });

  it("keeps binary objects private in R2 with an indexed PostgreSQL ledger", async () => {
    const [migration, storage, orchestrator] = await Promise.all([
      readFile("drizzle/0078_private_ai_attachment_platform.sql", "utf8"),
      readFile("src/server/attachments/object-storage.js", "utf8"),
      readFile("src/server/ai/orchestrator.js", "utf8")
    ]);
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ai_attachments");
    expect(migration).toContain("ai_attachments_status_created_idx");
    expect(migration).toContain("binary payloads stay in R2");
    expect(storage).toContain("getSignedUrl");
    expect(storage).toContain("HeadObjectCommand");
    expect(storage).toContain('ResponseCacheControl: "private');
    expect(storage).not.toContain("r2.dev");
    expect(orchestrator).toContain("ATTACHMENT_CONTEXT=");
    expect(orchestrator).toContain("لا تصل إليك كمدخلات متعددة الوسائط");
  });

  it("redacts credentials, authorization headers, OTPs, and card values before AI context", () => {
    const input = "api_key=sk_1234567890abcdefgh Authorization: Bearer token.value.123 OTP 482911 card 4111 1111 1111 1111";
    const redacted = redactAISecrets(input);
    expect(redacted).not.toContain("sk_1234567890abcdefgh");
    expect(redacted).not.toContain("token.value.123");
    expect(redacted).not.toContain("482911");
    expect(redacted).not.toContain("4111 1111 1111 1111");
    expect(sanitizeAIContext({ transcript: input })).toEqual({ transcript: redacted });
  });
});
