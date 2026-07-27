# 036 Testnet runbook

Build and deploy `contracts/payment-proof/` using the Testnet Soroban CLI flow:
upload, deploy, initialize, then simulate `create_payment` and
`confirm_payment`. Keep calendar scheduling and Horizon verification in the
app. Only an external signer may sign/submit; store resulting IDs and hashes
in the manifest.
