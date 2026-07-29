# Incident response

## Severity

- Critical: unauthorized signing, wrong recipient, leaked secret, or contract loss.
- High: incorrect amount, duplicate settlement, or Mainnet/Testnet mix-up.
- Medium: delayed indexing, broken reminders, or unavailable public UI.

## Response

Pause new payment creation, preserve hashes and logs, identify the affected release,
and communicate a clear user action. Do not delete ledger evidence. Restore service
only after reproducing the issue, adding a regression test, and verifying the
production configuration. Document the cause, impact, resolution, and follow-up.
