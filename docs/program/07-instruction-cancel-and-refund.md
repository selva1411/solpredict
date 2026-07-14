# Instructions: `cancel_market()` + `claim_refund()`

## `cancel_market()` (admin-only)
Used when: an event is ambiguous, oracle is down long-term, or
settlement auto-detects a one-sided market (see settle_market step 8).

### Accounts
`admin` (signer, == config.admin), `market` (mut).

### Logic
1. `require!(admin.key() == config.admin, Unauthorized)`.
2. `require!(market.status == Open, MarketNotOpen)` (can't cancel
   something already settled).
3. `market.status = Cancelled`.
4. `emit!(MarketCancelled { market_id })`.

## `claim_refund()` (any user with a position, cancelled markets only)

### Accounts
Same shape as `claim_rewards` but requires access to **both** mints
and **both** ATAs, since refunds apply to whichever side(s) the user
holds.

### Logic
1. `require!(market.status == Cancelled, MarketNotCancelled)`.
2. `require!(!user_position.claimed, AlreadyClaimed)`.
3. Read `yes_tokens` and `no_tokens` from both ATAs (whichever the
   user actually holds — one may be zero, that's fine).
4. `refund = (yes_tokens/10^6 + no_tokens/10^6) * share_price_lamports`
   — user gets back **exactly what they paid**, no fee taken on
   cancellation (fairness — it wasn't their fault the market was
   cancelled).
5. Burn whichever token balances are non-zero.
6. Transfer `refund` lamports treasury → user (same lamport-manipulation
   pattern as claim_rewards, same rent-exempt post-check).
7. `user_position.claimed = true`.
8. `emit!(RefundClaimed { market_id, user, refund })`.

## Acceptance Tests
- Cancel an already-Settled market → `MarketNotOpen`.
- Non-admin cancel attempt → `Unauthorized`.
- Refund on a still-Open (non-cancelled) market → `MarketNotCancelled`.
- User who bought both YES and NO gets both refunded correctly.
- Double refund attempt → `AlreadyClaimed`.