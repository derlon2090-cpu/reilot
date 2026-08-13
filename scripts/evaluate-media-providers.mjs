import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DeepgramSpeechProvider,
  GeminiVisionProvider,
  SpeechQualityEvaluator
} from "../src/server/ai/media-providers.js";

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function normalizedWords(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/u).filter(Boolean);
}

function editDistance(expected, actual) {
  const previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let row = 1; row <= expected.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= actual.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (expected[row - 1] === actual[column - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[actual.length];
}

function wordErrorRate(expected, actual) {
  const reference = normalizedWords(expected);
  const hypothesis = normalizedWords(actual);
  return reference.length ? editDistance(reference, hypothesis) / reference.length : null;
}

const manifestPath = String(process.env.MEDIA_EVAL_MANIFEST || "").trim();
if (!manifestPath) {
  fail("MEDIA_EVAL_MANIFEST is required. No provider call was made.");
} else if (!process.env.GEMINI_API_KEY || !process.env.DEEPGRAM_API_KEY) {
  fail("GEMINI_API_KEY and DEEPGRAM_API_KEY must be server-side environment variables. Values are never printed.");
} else {
  const manifest = JSON.parse(await readFile(path.resolve(manifestPath), "utf8"));
  const samples = Array.isArray(manifest.samples) ? manifest.samples : [];
  const audioSamples = samples.filter((sample) => sample.type === "audio");
  const imageSamples = samples.filter((sample) => sample.type === "image");
  if (audioSamples.length < 3 || imageSamples.length < 3) {
    fail("Evaluation requires at least 3 labeled audio samples and 3 labeled images; no quality claim was produced.");
  } else {
    const speech = new DeepgramSpeechProvider();
    const vision = new GeminiVisionProvider();
    const evaluator = new SpeechQualityEvaluator();
    const results = [];
    for (const sample of samples) {
      const bytes = await readFile(path.resolve(path.dirname(manifestPath), sample.path));
      if (sample.type === "audio") {
        const response = await speech.transcribe({
          bytes, locale: sample.locale || "ar-SA", dynamicTerms: sample.dynamicTerms || []
        });
        const quality = evaluator.evaluate(response, { requiredTerms: sample.requiredTerms || [] });
        results.push({
          id: String(sample.id || sample.path), type: "audio", locale: sample.locale || "ar-SA",
          acceptable: quality.acceptable, reasons: quality.reasons,
          confidence: response.confidence, durationSeconds: response.usage.durationSeconds,
          wordErrorRate: wordErrorRate(sample.expectedText, response.text),
          requiredTermsPreserved: quality.missingRequiredTerms.length === 0
        });
      } else if (sample.type === "image") {
        const response = await vision.analyzeImage({ bytes, mimeType: sample.mimeType });
        const serialized = JSON.stringify(response.result).toLocaleLowerCase();
        const phrases = Array.isArray(sample.expectedPhrases) ? sample.expectedPhrases : [];
        results.push({
          id: String(sample.id || sample.path), type: "image",
          schemaValid: true, confidence: response.result.confidence,
          expectedPhraseRecall: phrases.length
            ? phrases.filter((phrase) => serialized.includes(String(phrase).toLocaleLowerCase())).length / phrases.length
            : null,
          mediaResolution: response.mediaResolution
        });
      }
    }
    const audioWer = results.filter((item) => item.type === "audio" && item.wordErrorRate != null).map((item) => item.wordErrorRate);
    const imageRecall = results.filter((item) => item.type === "image" && item.expectedPhraseRecall != null).map((item) => item.expectedPhraseRecall);
    console.log(JSON.stringify({
      evaluatedAt: new Date().toISOString(), sampleCount: results.length,
      audio: {
        samples: audioSamples.length,
        averageWordErrorRate: audioWer.length ? audioWer.reduce((sum, value) => sum + value, 0) / audioWer.length : null,
        acceptableCount: results.filter((item) => item.type === "audio" && item.acceptable).length
      },
      images: {
        samples: imageSamples.length,
        averageExpectedPhraseRecall: imageRecall.length ? imageRecall.reduce((sum, value) => sum + value, 0) / imageRecall.length : null,
        schemaValidCount: results.filter((item) => item.type === "image" && item.schemaValid).length
      },
      results
    }, null, 2));
  }
}
