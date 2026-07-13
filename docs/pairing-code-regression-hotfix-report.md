# RenewPilot AI - Pairing Code Regression Hotfix Report

Date: 2026-07-13

## Result

1. Direct endpoint tested: `GET /evolution/instance/connect/{instanceName}?number={phoneNumber}`.
2. Evolution 2.3.7 returned HTTP 200 with `pairingCode` for a disposable instance created with `qrcode: false`.
3. Root cause: instances created with an eager QR (`qrcode: true`) returned a QR but left `pairingCode` empty for that session.
4. Fix: new instances are created with `qrcode: false`; QR is still requested later from the same unique instance.
5. The API extracts only a real provider code and never generates a fallback or fake code.
6. HTTP 200 without a code is reported as `PAIRING_CODE_NOT_RETURNED`, not as unsupported.
7. A connected channel now returns `INSTANCE_ALREADY_CONNECTED` and remains connected.
8. QR, Pairing Code, connection checks, and sending continue to use the channel's same `instance_name`.
9. Focused verification: 13 tests passed and the production build passed.
10. Browser verification returned a real eight-character provider code; the code itself is not recorded in this report.
11. A stale database status can no longer restart pairing for an already-open provider session: the API checks Evolution first, restores `connected`, and returns `INSTANCE_ALREADY_CONNECTED`.
12. The Pairing Code panel now exposes connection checking while pairing is pending.

Decision: **PASS** for new or disconnected linking sessions. An already connected device does not require a new pairing code.
