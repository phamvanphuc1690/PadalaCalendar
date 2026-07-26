# Mainnet readiness

Concept: scheduled remittance calendar with notifications and exact Horizon payment proof.

Current evidence: the safe slice now rejects fake hashes, requires a successful Horizon transaction with exact recipient/USDC issuer/amount, and protects the route with auth, rate limiting, and idempotency. No funded mainnet transaction or deployment evidence has been supplied.

Required gates: configure public network and USDC issuer, build unsigned XDR for an external wallet, reconcile missed schedules/retries, and record real transaction links. The Base bridge watcher is fail-closed and does not sign with a server-held Stellar secret; an external signer/intent worker must complete bridge payouts.

Status: **chain-proof slice implemented; not mainnet-ready until network evidence and runtime tests exist**.
