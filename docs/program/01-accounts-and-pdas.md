# Accounts & PDAs — Exact Layouts

## Config PDA (singleton)
- Seeds: `["config"]`
- Fields:
  - `admin: Pubkey`
  - `fee_bps: u16`           (validated ≤ 1000, i.e. max 10%)
  - `market_count: u64`      (auto-increments, used as each market's unique id)
  - `bump: u8`
- Created once by `initialize_config`. Anchor's `init` constraint
  naturally rejects a second call (account already exists).

## Market PDA (one per market)
- Seeds: `["market", market_id.to_le_bytes()]`
- Fields:
  - `market_id: u64`
  - `authority: Pubkey`               (creator, == config.admin for MVP)
  - `question: String`                (max 200 chars, enforce + allocate space)
  - `description: String`             (max 400 chars — settlement rules text)
  - `category: u8`                    (enum: Crypto/Sports/Politics/Tech/Other)
  - `oracle_feed_id: [u8; 32]`        (Pyth feed id — verified at settlement)
  - `target_price: i64`
  - `target_expo: i32`
  - `comparison: u8`                  (enum: GreaterThan / LessThan)
  - `end_ts: i64`                     (trading stops here)
  - `resolve_ts: i64`                 (earliest settlement allowed, ≥ end_ts)
  - `status: u8`                      (Open=0, Settled=1, Cancelled=2)
  - `winning_outcome: u8`             (Unset=0, Yes=1, No=2)
  - `yes_mint: Pubkey`, `no_mint: Pubkey`
  - `yes_pool_lamports: u64`, `no_pool_lamports: u64`
  - `yes_supply: u64`, `no_supply: u64`
  - `total_payout_pool: u64`          (computed at settlement)
  - `fee_collected: u64`
  - `fee_withdrawn: bool`             (double-withdraw guard)
  - `settled_price: i64`, `settled_expo: i32`, `settled_at: i64`
  - `share_price_lamports: u64`
  - `bump: u8`, `treasury_bump: u8`
- Space: `8 (discriminator) + sum(all fixed fields) + (4+200) + (4+400)
  + ~64 bytes padding`. Compute exactly in `state/market.rs` as a
  `pub const LEN: usize` — never hand-wave this number.

## Treasury PDA (one per market — SystemAccount, zero data)
- Seeds: `["treasury", market_pubkey]`
- Holds raw lamports only. Every payout/refund transfer must verify
  the treasury retains its rent-exempt minimum balance afterward.

## UserPosition PDA (one per user per market)
- Seeds: `["position", market_pubkey, user_pubkey]`
- Fields:
  - `owner: Pubkey`, `market: Pubkey`
  - `yes_amount: u64`, `no_amount: u64`
  - `claimed: bool`
  - `total_spent_lamports: u64`   (for portfolio P&L display)
  - `bump: u8`
- Token balances in the user's ATAs are the source of truth for
  claim amounts; this PDA is a portfolio-page index AND the
  double-claim guard (`claimed` flag).

## Token Mints (per market)
- `yes_mint` seeds: `["yes_mint", market_pubkey]`
- `no_mint` seeds: `["no_mint", market_pubkey]`
- Decimals: 6. Mint authority: **Market PDA**. Freeze authority: None.

## PDA Derivation Must Match EXACTLY Between Program and Client
Create `lib/pda.ts` on the frontend that mirrors every seed above
byte-for-byte (same seed order, same encoding — `u64` as little-endian
8 bytes via `toArrayLike(Buffer, 'le', 8)`). Any mismatch here causes
silent "account not found" bugs that are hard to debug — treat this
file as a single source of truth and unit-test it against known
program-side PDAs in Phase 1.