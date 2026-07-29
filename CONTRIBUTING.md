# Contributing

1. Create a focused branch from `main`.
2. Keep changes scoped to one behavior or documentation concern.
3. Run `npm test`, `npm run typecheck`, and `npm run lint`.
4. For contract changes, run the Rust unit tests and record any interface change
   in `docs/CONTRACT_API.md`.
5. Never replace Mainnet evidence with simulated or Testnet data.

Pull requests should explain the user impact, test evidence, migration needs, and
rollback plan. Changes that affect signing, recipient resolution, amount parsing,
or settlement confirmation require an additional reviewer.
