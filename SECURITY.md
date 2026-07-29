# Security policy

## Reporting

Report suspected vulnerabilities privately to the repository maintainers. Include
the affected route or contract function, reproduction steps, expected impact, and
whether Mainnet funds or personal data may be involved.

## Supported surface

The supported release is the current `main` branch and the deployed Vercel app.
Never include wallet seed phrases, secret keys, database credentials, or signed
transaction envelopes in an issue.

## Trust boundaries

PadalaCalendar does not custody funds. Freighter or another external signer owns
the signing decision. The Soroban contract records payment proof only; operators
must independently verify transaction success and contract ID before treating a
remittance as settled.
