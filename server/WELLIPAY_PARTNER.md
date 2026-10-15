# WelliPay partner API

WelliPay asks WelliRecord to prove that a person controls a WR-ID. WelliPay never receives the person's phone or email. A WR-ID is a reference. Proving control of it gives WelliPay no access to any record.

Set `WELLIPAY_PARTNER_KEY` on this service. It must equal `RECORD_INTEGRATION_WELLIRECORD_API_KEY` on the wellipay-api service. If it is unset, every call is refused with 503.

Both calls are `POST` with JSON and these headers:

- `Authorization: Bearer <key>`
- `X-WelliPay-Timestamp`: Unix seconds. Calls more than 5 minutes off are refused.
- `X-WelliPay-Signature`: `sha256=` plus the hex HMAC-SHA256 of `<timestamp>.<raw body>`, keyed with the same key.

**Start:** `POST /wellipay/v1/verifications` with `{ "requestId", "reference" }`. Always answers `202`. A 6-digit code goes by SMS to the patient's phone, or by email when there is no phone. At most 3 codes go to one WR-ID in 10 minutes.

**Confirm:** `POST /wellipay/v1/verifications/:requestId/confirm` with `{ "code" }`. Answers `200 { "verified": true, "reference" }` or `200 { "verified": false }`.

A code lasts 10 minutes, allows 5 tries and works once. Only a hash is stored, in the `wellipayverifications` collection (the same name the main WelliRecord backend uses).
