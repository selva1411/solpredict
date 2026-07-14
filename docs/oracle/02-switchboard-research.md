# Switchboard Research (Documentation Deliverable — No Implementation)

Write ~1 page covering:

## Architecture Comparison
- **Pyth**: first-party publishers (exchanges, market makers) push
  signed prices to Pythnet, aggregated, then pulled on-demand to
  target chains via Wormhole-signed updates + a receiver program.
- **Switchboard**: permissionless oracle network where anyone can
  run an oracle node; uses an on-demand "surge" pull model with TEE
  (trusted execution environment) attestation for data integrity.

## Update Model
- Pyth: pull-on-demand — consumer fetches from Hermes, posts on-chain
  right before use. No continuous on-chain writes = cheaper for
  low-frequency consumers.
- Switchboard: on-demand feeds also support a pull model now, but
  historically used a "crank" push model with a queue of oracle
  responses aggregated by a crank turner.

## Cost & Latency
- Pyth: near-zero on-chain storage cost between updates (only pay
  when you post); latency ≈ Hermes fetch + 1 transaction.
- Switchboard: similar on-demand costs now; historically push-model
  feeds cost more due to continuous account writes.

## When You'd Choose Each
- Pyth: best for major asset prices (SOL, BTC, ETH) with deep
  first-party publisher coverage — this project's use case.
- Switchboard: best for custom/niche data feeds (e.g. weather,
  sports scores, custom API data) via its permissionless job
  definition system, where Pyth has no coverage.

No code implementation required for this project — Pyth alone
satisfies the SOL/USD requirement.