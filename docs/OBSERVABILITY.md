# Observability

Track request failures, wallet connection failures, transaction confirmation
latency, duplicate hashes, and mismatched settlement parameters. Logs may contain
public addresses and hashes but must not contain secrets, signed envelopes, or
database credentials.

A useful production health view includes app availability, Horizon/RPC status,
pending reminders, confirmed payments, and the last successful contract call.
Alert on sustained API failure or repeated verification mismatch, not on a single
user-rejected wallet signature.
