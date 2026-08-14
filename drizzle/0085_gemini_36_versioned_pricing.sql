-- Correct already-applied development/staging databases and pin both published
-- Gemini 3.6 Flash standard-price windows. No request-path price is hard-coded.
DELETE FROM ai_provider_pricing
WHERE provider='gemini' AND model='gemini-3.6-flash' AND pricing_version='google-2026-08';

INSERT INTO ai_provider_pricing
  (provider,model,usage_type,native_unit,variant,price_per_unit_usd,pricing_version,valid_from,valid_until,metadata)
VALUES
 ('gemini','gemini-3.6-flash','input_token','token','standard',0.000000750000,'google-2026-h2','2026-08-01T00:00:00Z','2027-01-01T00:00:00Z','{"source":"Google Gemini published pricing"}'),
 ('gemini','gemini-3.6-flash','cached_input_token','token','standard',0.000000075000,'google-2026-h2','2026-08-01T00:00:00Z','2027-01-01T00:00:00Z','{"source":"Google Gemini published context caching price"}'),
 ('gemini','gemini-3.6-flash','output_token','token','standard',0.000003750000,'google-2026-h2','2026-08-01T00:00:00Z','2027-01-01T00:00:00Z','{"source":"Google Gemini published pricing"}'),
 ('gemini','gemini-3.6-flash','thought_token','token','standard',0.000003750000,'google-2026-h2','2026-08-01T00:00:00Z','2027-01-01T00:00:00Z','{"source":"Google Gemini published pricing","billed_as":"output"}'),
 ('gemini','gemini-3.6-flash','input_token','token','standard',0.000001500000,'google-2027-v1','2027-01-01T00:00:00Z',NULL,'{"source":"Google Gemini published pricing"}'),
 ('gemini','gemini-3.6-flash','cached_input_token','token','standard',0.000000150000,'google-2027-v1','2027-01-01T00:00:00Z',NULL,'{"source":"Google Gemini published context caching price"}'),
 ('gemini','gemini-3.6-flash','output_token','token','standard',0.000007500000,'google-2027-v1','2027-01-01T00:00:00Z',NULL,'{"source":"Google Gemini published pricing"}'),
 ('gemini','gemini-3.6-flash','thought_token','token','standard',0.000007500000,'google-2027-v1','2027-01-01T00:00:00Z',NULL,'{"source":"Google Gemini published pricing","billed_as":"output"}')
ON CONFLICT(provider,model,usage_type,variant,pricing_version) DO UPDATE SET
  price_per_unit_usd=EXCLUDED.price_per_unit_usd,
  valid_from=EXCLUDED.valid_from,
  valid_until=EXCLUDED.valid_until,
  metadata=EXCLUDED.metadata;
