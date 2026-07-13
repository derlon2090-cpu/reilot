# RenewPilot AI - Emergency QR Pairing Send Hotfix Report

1. QR failed because Vercel could not reach the Evolution host. The recorded provider error is `EVOLUTION_UNREACHABLE`.
2. QR loading now always ends through a 20-second browser deadline and `finally` cleanup.
3. Ten browser runs completed without stuck loading. All returned a clear provider-unreachable result in 15.1-17.4 seconds; no QR could be returned while the VPS was offline.
4. Pairing failed for the same network reason, not because the response parser rejected a valid code.
5. Pairing calls `connect?number=966556915980` after converting `0556915980` to the international form.
6. Ten browser pairing runs completed without stuck loading in 15.1-15.8 seconds.
7. The old send UI reported failure after delivery because its provider timeout expired before the delayed Evolution response and audit persistence happened inside the same failure path.
8. Send timeout is now provider delay plus 20 seconds. A provider timeout returns `pending_verification`, not a false failure.
9. A new message was not sent during this stability test because the connected channel could not be verified while Evolution was unreachable.
10. `notification_logs` are created with `sending` before provider dispatch and become `sent` after provider success.
11. `message_usage` increments only after provider success.
12. `activity_logs` records `send_test_message` after provider success.
13. QR, pairing, connection checks, and send-test use the stored channel `instance_name`; refresh does not replace it.
14. Decision: hotfix behavior PASS; live Evolution QR/pairing FAIL until `51.210.77.137` is reachable again.

Verification: 17 focused tests passed and the production build completed successfully. Commit `814edf4` is deployed through `main`.
