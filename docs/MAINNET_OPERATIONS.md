# Mainnet operations

## Before enabling a release

- Confirm the configured network passphrase is Stellar Public Global Network.
- Compare the contract ID with `contracts/payment-proof/deployment.json`.
- Verify the Vercel environment contains no Testnet RPC or Horizon endpoints.
- Run unit tests, type checking, linting, and the production build.

## Daily checks

Check the public app, Horizon availability, recent failed confirmations, and the
latest contract transaction. A payment remains pending until its transaction is
successful and its parameters match the scheduled recipient and amount.

## Key handling

Operators never collect user secret keys. Deployment and administrative calls use
an external wallet with the minimum required balance and a documented signer.
