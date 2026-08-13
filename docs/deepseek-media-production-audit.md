# DeepSeek, Vision, STT, and R2 production audit

Audit date: 2026-08-13 (Asia/Riyadh)

No secret value was read, printed, stored, or added during this audit.

## DEEPSEEK

Status: Backend implementation is present and server-only in the current source. The provider reads `DEEPSEEK_API_KEY`; no public DeepSeek variable or direct browser-to-DeepSeek request was found. Public variable names are now rejected by the provider configuration check.

Backend location: `src/server/ai/provider.js`, called by `src/server/ai/orchestrator.js`.

Production test: Not completed. `api.renvix.app` is hosted by Render, but the available browser session is not authenticated and there is no Render control-plane/shell access in this workspace. The deployed public health response also does not contain the newer attachment/storage checks, which indicates that the current local revision has not yet been verified as deployed.

Required Render variables:

- `DEEPSEEK_API_KEY` — required secret.
- `DEEPSEEK_BASE_URL` — optional; defaults to `https://api.deepseek.com`.
- `DEEPSEEK_FLASH_MODEL` — optional; defaults to `deepseek-v4-flash`.
- `DEEPSEEK_PRO_MODEL` — optional; defaults to `deepseek-v4-pro`.

Missing:

- Redeploy the current revision on Render after confirming `DEEPSEEK_API_KEY` is present there.
- Run `npm run ai:smoke` in the Render Shell. It requests only `Respond only with: OK`, verifies response usage, and never prints the key or Authorization header.

## VISION

Provider: NONE.

Status: Partial, not production-ready. The code contains a replaceable `VisionProvider` contract, an injectable OpenAI-compatible test adapter, R2 retrieval, structured result storage, per-tenant content-hash reuse, and attachment metrics. No concrete production Vision provider is configured.

Required Render variables now: None. Generic `VISION_API_KEY`, `VISION_API_URL`, and `VISION_MODEL` placeholders were removed until a real provider is approved.

Backend location: `src/server/ai/media-processing.js`.

Recommended provider for Renvix: Google Gemini API.

Reason: Strong screenshot/document understanding, tables and UI interpretation, native multimodal input, structured JSON schema support, low-latency Flash options, and a simple server-side API. Use a new Gemini auth key rather than an unrestricted legacy key.

Required Render variable after approval: `GEMINI_API_KEY`.

Where to obtain: Google AI Studio → API Keys → Create API key. Restrict it to the Gemini API and keep it server-side.

Alternative: OpenAI vision-capable models through the Responses API. Required secret: `OPENAI_API_KEY`, obtained from OpenAI Platform → Project → API Keys.

Short comparison:

| Provider | Screenshot/table/Arabic fit | Structured JSON | Published price reference | Latency/API/privacy note |
| --- | --- | --- | --- | --- |
| Gemini 3.6 Flash | Strong multimodal/document tooling; Arabic must be evaluated on Renvix samples | Native JSON schema | $1.50/M input, $7.50/M output | Fast Flash path; paid-tier content is documented as not used to improve products |
| OpenAI GPT-5.6 Luna/Terra | Strong multilingual image input and UI reasoning | Native structured outputs | Luna $1/M input, $6/M output; Terra $2.50/M input, $15/M output | Very simple unified API with the recommended STT option; review retention/DPA settings before launch |

Missing:

- Approve a provider.
- Implement its concrete adapter and response schema validation.
- Add provider-specific cost ledger fields and production evaluation images for Arabic screenshots, tables, and dashboards.
- Run real production image upload, R2 download, analysis, result-cache, and follow-up reuse tests.

## STT

Provider: NONE.

Status: Partial, not production-ready. The code contains a replaceable `SpeechProvider` contract, an injectable OpenAI-compatible test adapter, R2 retrieval, transcript storage/reuse, and separate transcription metrics. No concrete production STT provider is configured.

Required Render variables now: None. Generic `SPEECH_API_KEY`, `SPEECH_API_URL`, and `SPEECH_MODEL` placeholders were removed until a real provider is approved.

Backend location: `src/server/ai/media-processing.js`.

Supported upload formats in Renvix: `webm`, `ogg`, `m4a` (`audio/mp4`), and `mp3`, up to 10 MB and five minutes. WAV is not currently accepted by the upload validator.

Arabic support: The adapter prompt is Arabic-first, but real Arabic quality cannot be claimed without a selected provider and production evaluation.

Recommended provider for Renvix: OpenAI GPT-4o Transcribe.

Reason: Good multilingual transcription, improved recognition over original Whisper, prompt guidance for product names, a simple prerecorded-audio endpoint, and a practical fit for mixed Arabic/English recordings. Production evaluation against Saudi/Gulf samples is still required.

Required Render variable after approval: `OPENAI_API_KEY`.

Where to obtain: OpenAI Platform → Project → API Keys → Create new secret key with the minimum required permissions.

Alternatives:

- Deepgram Nova-3: `DEEPGRAM_API_KEY`, from Deepgram Console → API Keys. Strong streaming and explicit `ar-SA` support; Arabic/English code-switching must be evaluated because the documented `language=multi` set is narrower than the Arabic dialect list.
- Google Cloud Speech-to-Text Chirp 3: service-account credentials and project configuration from Google Cloud Console. It lists `ar-SA`, but the current Saudi Chirp 3 availability is Preview and should be risk-tested before production selection.

Short comparison:

| Provider | Arabic/mixed-language fit | Streaming | Published price reference | Operational note |
| --- | --- | --- | --- | --- |
| OpenAI GPT-4o Transcribe | Strong general multilingual recognition and promptable terminology; Saudi samples still required | Yes | Token-billed: $2.50/M audio input tokens and $10/M output tokens | Simplest shared provider if OpenAI is also selected for Vision |
| Deepgram Nova-3 | Explicit `ar-SA` and Arabic dialect support; Arabic/English code-switch needs a dedicated eval | Yes, excellent low latency | About $0.0048/min monolingual or $0.0058/min multilingual PAYG | Lowest clear per-minute price; keyterm prompting can help product names |
| Google Chirp 3 | Explicit `ar-SA`, currently Preview | Yes | $0.016/min standard V2; $0.003/min dynamic batch | Strong enterprise controls and data residency, but heavier credentials/setup |

Missing:

- Approve a provider.
- Implement the concrete adapter using its real credential name.
- Evaluate Saudi/Gulf Arabic, mixed Arabic/English, English product names, latency, and cost.
- Add provider-specific STT cost ledger fields and production transcription tests.

## R2

Status: Backend implementation is present and uses private S3-compatible objects plus short-lived presigned URLs. Current local source includes upload signing, HEAD verification, private download signing, object prefix validation, deletion, and bucket health.

Required Render variables:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_ENDPOINT` is optional because the backend derives it from `R2_ACCOUNT_ID`.

Where to obtain: Cloudflare Dashboard → Storage & databases → R2 → Overview. Create/select the bucket, then Manage API Tokens → create a token scoped to the required bucket and read/write operations. The Access Key ID, Secret Access Key, and S3 endpoint are shown when the token is created.

Required variables present/missing: Unknown in Render; local process variables are absent, and secret values were intentionally not requested or inspected.

Production upload test: Not executed; requires an authenticated Renvix production session and the current revision deployed.

Production download test: Not executed for the same reason.

## Usage separation

- DeepSeek customer balance is deducted only from actual DeepSeek input/output token usage.
- Vision and audio currently emit their own attachment metrics and do not deduct from the customer DeepSeek token entitlement.
- Provider-specific Vision/STT cost ledgers remain missing work to complete after provider approval.

## Official references

- DeepSeek Chat Completions and usage: https://api-docs.deepseek.com/api/create-chat-completion/
- DeepSeek thinking mode: https://api-docs.deepseek.com/guides/thinking_mode
- Gemini image understanding: https://ai.google.dev/gemini-api/docs/image-understanding
- Gemini structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini API keys: https://ai.google.dev/gemini-api/docs/api-key
- OpenAI transcription model: https://developers.openai.com/api/docs/models/gpt-4o-transcribe
- Deepgram Arabic model support: https://developers.deepgram.com/docs/models-languages-overview/
- Google Cloud Speech-to-Text languages: https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages
- Cloudflare R2 S3 credentials: https://developers.cloudflare.com/r2/get-started/s3/
