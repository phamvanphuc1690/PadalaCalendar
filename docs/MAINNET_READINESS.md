# Mainnet readiness

Concept: scheduled remittance calendar with notifications and exact Horizon payment proof.

Current evidence: the safe slice rejects fake hashes, requires a successful Horizon transaction with exact recipient/USDC issuer/amount, and protects the route with auth, rate limiting, and idempotency. The payment-proof Soroban contract is deployed and initialized on Stellar Public Mainnet, with a verified `create_payment` and `confirm_payment` flow.

Required gates: reconcile missed schedules/retries and keep the external-wallet signing flow for real payouts. The Base bridge watcher is fail-closed and does not sign with a server-held Stellar secret; an external signer/intent worker must complete bridge payouts. The Mainnet contract evidence is recorded in `contracts/payment-proof/deployment.json`.

Status: **functional Mainnet contract flow verified; the public app remains a hackathon demo and does not custody or sign user funds**.
