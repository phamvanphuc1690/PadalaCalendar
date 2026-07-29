# Transaction verification

For every claimed remittance:

1. Look up the hash on Stellar Expert or Horizon Mainnet.
2. Require a successful ledger result.
3. Confirm the source account and destination match the expected participants.
4. Confirm the amount, asset, memo, and operation type.
5. For Soroban evidence, confirm the invoked contract ID and function.
6. Store the hash once and reject duplicate settlement attempts.

The latest verified contract flow is recorded in
`contracts/payment-proof/deployment.json`. Explorer links are evidence, not a
substitute for server-side parameter verification.
