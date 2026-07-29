# PaymentProof contract

Minimal Soroban registry for scheduled remittance settlement. The app keeps
the calendar and Horizon proof flow; this contract stores the payer, recipient,
amount, expiry and verified transaction reference.

## Mainnet deployment

- Network: Stellar Public Mainnet
- Contract: `CDP7K67V3NABQ4OKSOQD7NICBUBEH472RD53DY2JQUI7TBJPX3MJXK5U`
- Source wallet: `GCUPLPBIZ7PXLRTMJOJ27ILHWDGCTCQ34763VYCSFDLO7DOIH7CLOB6P`
- Verified flow: `initialize -> create_payment -> confirm_payment`
- Create payment: [`196cfff35b043d9b68a477a60cba9b4444637d0c28ca1faf21c68c7ca0ba9833`](https://stellar.expert/explorer/public/tx/196cfff35b043d9b68a477a60cba9b4444637d0c28ca1faf21c68c7ca0ba9833)
- Confirm payment: [`dc2c1a014e9312e2efec4c38881ba77d1d40e667e5b32011c97c6bb0371627b0`](https://stellar.expert/explorer/public/tx/dc2c1a014e9312e2efec4c38881ba77d1d40e667e5b32011c97c6bb0371627b0)

The contract records a payment proof and settlement reference; it does not
custody or transfer USDC itself.

```bash
cargo test --manifest-path contracts/payment-proof/Cargo.toml
```
