# AI media, accounting, and hard-delete runbook

## Runtime configuration

Only server-side variables are accepted: `GEMINI_API_KEY` and `DEEPGRAM_API_KEY`.
Optional model and quality settings are `GEMINI_VISION_MODEL`, `DEEPGRAM_STT_MODEL`,
`DEEPGRAM_MIN_CONFIDENCE`, `DEEPGRAM_MIN_TRANSCRIPT_CHARACTERS`,
`DEEPGRAM_MAX_LOW_CONFIDENCE_WORD_RATIO`, and `DEEPGRAM_LOW_CONFIDENCE_WORD_THRESHOLD`.
Never create `NEXT_PUBLIC_*` variants.

## Provider flow

- Images use the official Google Gen AI SDK, strict JSON Schema plus Zod validation,
  one retry only for invalid JSON/schema, medium resolution by default, and high
  resolution for large/dense images.
- Audio uses the official Deepgram SDK with Nova-3, `ar-SA` or `en-US`,
  `smart_format=true`, `keyterm`, and MIP opt-out.
- Gemini audio fallback runs only after Deepgram failure or centralized quality
  rejection. A good Deepgram result never calls the fallback.
- Cache reuse is tenant-scoped and creates no provider reservation or deduction.

## Accounting

`ai_provider_usage_ledger` stores provider-native usage, provider request IDs,
versioned price snapshots, actual confirmed cost, conversion version, and Renvix
quota units. It never stores filenames, transcripts, image contents, or object keys.
Missing provider usage remains `unconfirmed` with null actual cost and zero deduction.

Gemini 3.6 Flash pricing is pinned to two published effective windows: the 2026
promotional window and the standard window starting 2027-01-01. Deepgram is priced
from provider duration multiplied by channels, with the keyterm add-on separated.

## Hard delete

The state machine is `active -> deleting -> deleted`. The service accepts only an
attachment UUID, resolves tenant/user ownership server-side, deletes the original
and every derived R2 key, verifies absence with HEAD, replaces the message attachment
with `تم حذف المرفق`, then physically deletes the PostgreSQL attachment row. A
content-free tombstone keeps the operation idempotent.

Queued cleanup jobs use bounded batches, `SKIP LOCKED`, three item attempts, progress,
and cron reconciliation. Ticket attachments and exports are explicitly protected
because they are business/operational records in this repository; the chat cleanup
job never infers permission to delete them.

Backups are outside the live hard-delete transaction. Database/R2 backup retention
must be documented separately with the infrastructure provider; live deletion does
not claim to purge immutable backups before their configured retention expires.

## Verification status

- Local migrations 0084 and 0085: applied successfully.
- Focused unit/integration suite: 21 tests passed.
- Typecheck and production build: passed.
- Real Render provider evaluation: **not run from this workspace** because provider
  keys are present only in Render and no labeled production audio/image fixture set
  was supplied. Do not claim Arabic, noisy-audio, or mixed-language quality until the
  command below passes with representative labeled samples.

Run from a trusted server shell without printing keys:

```sh
MEDIA_EVAL_MANIFEST=/secure/fixtures/manifest.json npm run ai:media-eval
```

The evaluator requires at least three labeled audio samples (including Arabic and
mixed terminology) and three labeled images. It prints aggregate WER/schema/phrase
recall metrics and never prints transcripts or key values.
