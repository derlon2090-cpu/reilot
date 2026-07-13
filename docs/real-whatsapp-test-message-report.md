# RenewPilot AI - Real Test Message Report

Date: 2026-07-13

## Result

1. Connected sender: `966551***0581`.
2. Instance used: `rp_3448c7a0_...483e9`.
3. Evolution state before sending: `open` (mapped to `connected`).
4. Recipient after normalization: `966556***5980`.
5. Exactly one requested test message was sent; the recipient confirmed delivery.
6. No other recipient or instance was used, and no disconnect was performed.
7. The original API request timed out because Evolution's configured send delay was 20 seconds while the client timeout was 15 seconds.
8. Because the request timed out before the database transaction, that historical attempt has no reliable `provider_message_id`, `notification_logs`, `message_usage`, or `send_test_message` activity row. No records were fabricated or backfilled.
9. Fix: the Evolution request timeout now includes the configured provider delay plus a 15-second response window.
10. No duplicate message was sent while verifying the fix.

Decision: **PASS** for real delivery. Audit persistence is fixed for subsequent sends; the delivered historical attempt remains intentionally unmodified.
