# Pyth Oracle Integration — Full Spec

## Which Model
Use the **Pyth pull oracle** via `pyth-solana-receiver-sdk` (on-chain)
and `@pythnetwork/hermes-client` + `@pythnetwork/pyth-solana-receiver`
(off-chain/client). Flow:

1. Client (frontend admin panel OR a settlement script) fetches a
   signed price update (VAA) for SOL/USD from Hermes:
   `https://hermes.pyth.network`.
2. Client posts the update on-chain via the Pyth receiver program,
   creating an ephemeral `PriceUpdateV2` account.
3. That account is passed into `settle_market` **in the same
   transaction bundle** (or immediately after, same block context)
   so the price can't go stale between posting and reading.
4. On-chain, the program calls:
   `price_update.get_price_no_older_than(&clock, 60, &feed_id)`.

## Feed ID
**Do not hardcode a feed id from memory.** Verify the current SOL/USD
feed id at implementation time from the official Pyth price feed
list: https://pyth.network/developers/price-feed-ids — store the
verified value as a named constant in `constants.rs` with a comment
linking to the source and the date verified.

## Validation Rules (ALL enforced on-chain, not just client-side)

| Rule | Threshold | Error on failure |
|---|---|---|
| Staleness | `publish_time` within 60s of current slot time | `StaleOracle` |
| Feed identity | update's feed id == `market.oracle_feed_id` | `InvalidOracleFeed` |
| Confidence | `conf / price ≤ 2%` | `LowOracleConfidence` |
| Exponent | normalized via i128, never floats | `MathOverflow` on failure |

## Why Client-Side Validation Alone Is Insufficient
A malicious or buggy frontend could try to pass a stale/wrong price
to `settle_market` directly (anyone can call an on-chain instruction
with any accounts they want, bypassing your UI entirely). All four
rules above MUST be enforced inside the Rust program, not just in
TypeScript. The frontend validation exists only for UX (showing a
"price is stale, try again" message before wasting a transaction).

## Admin Settlement Script
Provide `scripts/settle-market.ts` that:
1. Fetches latest Hermes update for the configured feed.
2. Posts it via the Pyth receiver program.
3. Calls `settle_market` with the resulting account.
4. Optionally closes the ephemeral price account to reclaim rent.
This same logic is reused in the Admin UI's "Settle" button
(see `frontend/01-pages-and-routes.md` → Admin Console).