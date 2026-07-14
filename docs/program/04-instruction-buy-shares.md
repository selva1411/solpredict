# Instruction: `buy_shares(side: Side, quantity: u64)`

Implement as **one** instruction with a `Side { Yes, No }` enum
(cleaner than duplicating buy_yes/buy_no on-chain). Expose two
convenience wrappers client-side: `buyYes()` / `buyNo()` that just
call `buyShares({ yes: {} }, qty)` / `buyShares({ no: {} }, qty)`.

## Accounts
| Account | Type | Notes |
|---|---|---|
| `buyer` | Signer, mut | pays SOL |
| `market` | mut | validated Open + not expired |
| `treasury` | mut | receives SOL |
| `yes_mint` / `no_mint` | mut | pass both; program selects by `side` |
| `buyer_ata` | init_if_needed, ATA for chosen mint | receives minted tokens |
| `user_position` | init_if_needed, PDA `["position", market, buyer]` | |
| `token_program`, `associated_token_program`, `system_program` | Programs | |

## Logic
1. `require!(market.status == Open, MarketNotOpen)`.
2. `require!(Clock::get()?.unix_timestamp < market.end_ts, MarketExpired)`
   — **critical**: never trust a client-supplied "is it open" flag.
3. `require!(quantity > 0 && quantity <= MAX_SHARES_PER_TX, InvalidQuantity)`
   (define `MAX_SHARES_PER_TX` in `constants.rs`, e.g. 1_000_000 —
   prevents overflow-crafting attacks).
4. `let cost = quantity.checked_mul(market.share_price_lamports)
     .ok_or(MathOverflow)?;`
5. CPI: `system_program::transfer` — `cost` lamports, buyer → treasury.
6. CPI: `token::mint_to` — mint `quantity * 10^6` base units to
   `buyer_ata`. **Signer seeds = market PDA's own seeds** (this is
   the PDA-signs-for-itself pattern — mint authority is the market,
   so the program provides the market's seeds + bump as the CPI signer).
7. Update pools/supplies with `checked_add` based on `side`.
8. Update (or initialize) `user_position`: increment `yes_amount` or
   `no_amount`, add to `total_spent_lamports`; set `owner`/`market`
   on first purchase.
9. `emit!(SharesPurchased { market_id, buyer, side, quantity, cost,
     new_yes_pool, new_no_pool })` — powers the live activity feed
   and live-updating probability bar on the frontend.

## Acceptance Tests
- Buy after `end_ts` → `MarketExpired`.
- Buy on `Settled`/`Cancelled` market → `MarketNotOpen`.
- `quantity = 0` → `InvalidQuantity`.
- `quantity` at the overflow boundary with max share price →
  `MathOverflow`, and **state must be unchanged** (no partial writes).
- Two different buyers both sides → pool/supply math is exact.
- Repeat buys by the same user accumulate correctly in `user_position`
  (not overwritten).