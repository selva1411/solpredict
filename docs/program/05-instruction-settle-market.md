# Instruction: `settle_market()`

## Accounts
| Account | Type | Notes |
|---|---|---|
| `admin` | Signer | must equal `config.admin` |
| `config` | read-only | |
| `market` | mut | |
| `pyth_price_update` | PriceUpdateV2 account (from Pyth receiver) | posted just before this ix in the same transaction bundle |

## Logic
1. `require!(admin.key() == config.admin, Unauthorized)`.
2. `require!(market.status == Open, AlreadySettled)` — blocks
   **double settlement** outright.
3. `require!(Clock::get()?.unix_timestamp >= market.resolve_ts,
     TooEarlyToSettle)`.
4. **Oracle read** — see `oracle/00-pyth-integration.md` for full
   rules. In short: call
   `price_update.get_price_no_older_than(&clock, MAX_STALENESS_SECS, &market.oracle_feed_id)`.
   This single call enforces BOTH (a) the update is for the exact
   feed id stored on this market (prevents substituting a wrong/fake
   price account) and (b) staleness ≤ 60s. On failure → `StaleOracle`
   or `InvalidOracleFeed` depending on which check failed.
5. **Confidence check**:
   `require!(price.conf.checked_mul(100).ok_or(MathOverflow)? <
     (price.price.unsigned_abs() as u64).checked_mul(MAX_CONF_PCT)...,
     LowOracleConfidence)`.
6. **Exponent normalization** (i128 math, never floats) — see full
   worked example in `oracle/01-price-math-worked-examples.md`.
7. Determine winner per `market.comparison` (GreaterThan/LessThan).
8. **One-sided market check**: if winning side's supply == 0, set
   `status = Cancelled` and return early — do NOT proceed to fee/
   payout math. Users use the refund path instead (see
   `07-instruction-cancel-and-refund.md`).
9. Compute:
   - `total_pool = yes_pool.checked_add(no_pool)?`
   - `losing_pool = if winner == Yes { no_pool } else { yes_pool }`
   - `fee = losing_pool.checked_mul(fee_bps as u64)?.checked_div(10_000)?`
   - `total_payout_pool = total_pool.checked_sub(fee)?`
10. Store `winning_outcome`, `settled_price/expo/at`, `fee_collected`,
    `total_payout_pool`; set `status = Settled`.
11. `emit!(MarketSettled { market_id, winning_outcome, settled_price,
      total_payout_pool })`.

## Acceptance Tests
- Non-admin caller → `Unauthorized`.
- Called before `resolve_ts` → `TooEarlyToSettle`.
- Called twice → `AlreadySettled` on the second call.
- Stale price (`publish_time` older than 60s) → `StaleOracle`.
- Wrong Pyth feed account passed → `InvalidOracleFeed`.
- Huge confidence interval → `LowOracleConfidence`.
- One-sided market (e.g. only YES ever bought, price says NO wins)
  → auto-cancels instead of stranding funds.
- Correct price above target → YES wins; below → NO wins (test
  both directions of `comparison`).