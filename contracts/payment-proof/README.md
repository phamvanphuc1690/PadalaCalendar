# PaymentProof contract

Minimal Soroban registry for scheduled remittance settlement. The app keeps
the calendar and Horizon proof flow; this contract stores the payer, recipient,
amount, expiry and verified transaction reference.

```bash
cargo test --manifest-path contracts/payment-proof/Cargo.toml
```
