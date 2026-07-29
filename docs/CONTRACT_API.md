# Payment-proof contract API

Mainnet contract: `CDP7K67V3NABQ4OKSOQD7NICBUBEH472RD53DY2JQUI7TBJPX3MJXK5U`

## Lifecycle

- `initialize(admin)` configures the administrator once.
- `create_payment(...)` records a new remittance proof intent.
- `confirm_payment(...)` attaches the settlement reference and marks the record
  confirmed.
- Read methods return stored proof data without modifying the ledger.

All state-changing calls require the expected signer authorization. Amounts use
integer stroops; clients must never pass floating-point values to the contract.
Contract invocations should be simulated immediately before signing.
