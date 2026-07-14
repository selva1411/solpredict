# Instruction: `claim_rewards()`

## Accounts
| Account | Type | Notes |
|---|---|---|
| `claimer` | Signer | |
| `market` | read | must be Settled |
| `treasury` | mut | pays out |
| `winning_mint` | mut | yes_mint or no_mint, selected client-side based on `market.winning_outcome` |
| `claimer_ata` | mut | claimer's ATA for the winning mint |
| `user_position` | mut | |
| `token_program` | Program | |

## Logic
1. `require!(market.status == Settled, MarketNotSettled)`.
2. `require!(!user_position.claimed, AlreadyClaimed)`.
3. `let user_tokens = claimer_ata.amount;`
   `require!(user_tokens > 0, NothingToClaim)` — this covers losers
   automatically (their winning-side ATA balance is 0).
4. **Payout math** (see `utils/payout_math.rs` — always i128 checked,
   floor-rounded so the treasury is never over-drained; any dust
   remainder stays in treasury permanently, which is fine):
   ```
   user_shares = user_tokens / 10^6
   payout = floor( total_payout_pool * user_shares / winning_supply )
   ```
5. CPI: `token::burn` — burn ALL `user_tokens` from `claimer_ata`,
   mint = winning_mint, authority = claimer (user signs for their
   own tokens here, NOT a PDA).
6. Transfer `payout` lamports treasury → claimer via direct lamport
   manipulation (`try_borrow_mut_lamports`, since Treasury is a plain
   PDA SystemAccount with no `transfer` CPI needed) — **after** the
   transfer, assert treasury lamports ≥ rent-exempt minimum, else
   `TreasuryInsufficient` (should never trigger if math is correct,
   but is a defense-in-depth check).
7. `user_position.claimed = true`.
8. `emit!(RewardsClaimed { market_id, claimer, payout })`.

## Acceptance Tests
- Claim before settlement → `MarketNotSettled`.
- Claim twice → `AlreadyClaimed` on second attempt.
- Loser (holds only losing-side tokens) → `NothingToClaim`.
- Two winners split the pool exactly pro-rata (sum of payouts ≤
  `total_payout_pool`, difference is only floor-rounding dust).
- Attempting to pass someone else's `user_position` PDA → Anchor
  seeds constraint violation (not a manual check — enforce via
  `#[account(seeds = [..., claimer.key().as_ref()], bump)]`).