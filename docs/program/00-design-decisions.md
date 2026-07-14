# Program Design Decisions (Lock These In Before Coding)

## 1. Currency
Markets are funded in **SOL (lamports)**, held in a per-market
Treasury PDA. USDC support is a documented Phase-2 stretch goal
(see `frontend/.../future-enhancements` — not in MVP scope).

## 2. Pricing Model — Fixed-Price Parimutuel (NOT an AMM)
Every share costs a fixed price set at market creation
(e.g. 0.01 SOL/share). All SOL from both sides pools into one
Treasury. At settlement, `total_pool − fee` is split **pro-rata**
among winning shareholders. This is simpler and strictly safer
than an AMM for an MVP — no risk of pricing-curve exploits,
no impermanent loss concepts to explain to users.

Display "implied probability" in UI as:
    probability = yes_pool_lamports / (yes_pool_lamports + no_pool_lamports)
(default to 50% when both pools are empty — avoid divide-by-zero).

## 3. Positions = Per-Market SPL Tokens
Each market gets its own YES mint and NO mint, created at
`initialize_market`, with **mint authority = the Market PDA itself**
(not a human key — this is what makes claims/burns trustless).
Decimals = 6 for both mints. 1 share = 1_000_000 base units.

## 4. Admin Model
A singleton **Config PDA** stores the admin pubkey, set once via
`initialize_config`. Only this admin can create markets, settle
markets, cancel markets, and withdraw fees for MVP. Permissionless
creation is a documented Phase-2 idea, not in scope now.

## 5. Fees
Protocol fee in basis points (e.g. 200 = 2%), taken from the
**losing pool only** at settlement time, withdrawable by admin
via a dedicated instruction (never auto-transferred — explicit
withdrawal keeps accounting auditable on-chain).

## 6. What Happens On a One-Sided Market?
If the winning side has zero supply (nobody bet on the side that
won), settlement must NOT strand the losing side's funds. Instead,
the program auto-flips status to **Cancelled** and losers can use
the refund path to get their exact stake back. Documented fully in
`07-instruction-cancel-and-refund.md`.

## 7. Time Source
All time comparisons use `Clock::get()?.unix_timestamp` on-chain.
The client-supplied timestamp is NEVER trusted for validation logic
— only used for UI countdown displays.

## 8. Arithmetic Policy
Zero raw `+ - * /` on any lamport/token/fee value anywhere in the
program. Every operation is `checked_add`/`checked_sub`/`checked_mul`/
`checked_div`, and payout math uses `i128`/`u128` intermediates to
avoid overflow before narrowing back to `u64`. See
`utils/payout_math.rs` spec in the buy/claim instruction docs.