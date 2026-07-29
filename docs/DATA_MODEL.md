# Data model

- Recipient: display name, public Stellar address, optional federation address.
- Schedule: owner, recipient, due date, asset, amount, and reminder state.
- Payment proof: schedule reference, transaction hash, ledger, and confirmation
  state.
- Wallet session: public address, nonce, issue time, and expiry.

Store monetary amounts as integers in the asset's smallest unit. Transaction hashes
and schedule identifiers must be unique. Demo records must be isolated from
production records and visually labelled.
