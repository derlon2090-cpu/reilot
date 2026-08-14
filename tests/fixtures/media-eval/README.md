# Media provider evaluation corpus

This fixture set is intentionally non-sensitive and is safe to use in Render or a secret-bearing CI environment.

- Six synthetic WAV recordings cover Saudi Arabic, English, mixed Arabic/English, and provider key terms.
- Three images cover an Arabic interface, a mixed Arabic/English attachment UI, and a numeric dashboard/table.
- No customer identifiers, transcripts from production, credentials, provider keys, or signed R2 URLs are included.

Run the live provider evaluation only where the server-side keys already exist:

```powershell
$env:MEDIA_EVAL_MANIFEST = "tests/fixtures/media-eval/manifest.json"
npm run ai:media-eval
```

The evaluator prints aggregate quality and usage metadata. It must not print full transcripts or secret values. A provider HTTP success alone is not a release gate; schema validation, phrase recall, speech quality, accounting settlement, idempotency, and hard deletion must also pass.
