# SPL Token Flow — Explicit Diagram

    BUY:
      user pays N × share_price SOL  ──►  Treasury PDA
      Market PDA (mint authority) mints N YES/NO tokens (6 dp)
                                       ──►  user's ATA

    SETTLE:
      Oracle decides winner; pool math computed & frozen
      on the Market account (no token movement yet)

    CLAIM (winner):
      Program burns user's winning tokens from their ATA
      Treasury PDA transfers pro-rata SOL payout ──► user wallet

    CANCEL → REFUND:
      Program burns ALL of user's tokens (both sides, whatever they hold)
      Treasury refunds exact original purchase price, no fee taken

## Research Topics (document findings in README before implementing)
- **Mint account anatomy**: supply, decimals, mint authority, freeze
  authority fields; why freeze authority = None here (no need to
  freeze prediction-market position tokens).
- **Associated Token Account (ATA)**: deterministic address derived
  from `(wallet, mint, token_program)` — why this lets the frontend
  compute a user's token account address without an RPC round-trip.
- **Token Program CPI with PDA signer seeds**: how a PDA (the Market
  account) can "sign" a `mint_to`/`burn` CPI despite having no
  private key, via `CpiContext::new_with_signer` and passing the
  exact seeds + bump used to derive that PDA.
- **Mint vs Burn vs Transfer**: this project uses mint (on buy) and
  burn (on claim/refund) but never a plain `transfer` of YES/NO
  tokens between users — positions are non-transferable by design
  for MVP simplicity (documented as a Phase-2 idea: secondary
  market trading of position tokens).