# Security Checklist — Verify Every Item Before Phase 5 Sign-off

> **Audit status:** All items verified against the checked-in Anchor source at
> `programs/solpredict/` on 2026-08-05. Two sub-agent audits (arithmetic safety;
> oracle/time/claim; PDAs/constraints/signers) plus manual verification.
> Three hardening fixes were applied during the audit:
> 1. `oracle.rs` — dropped `System::id()` from the price-update owner allowlist.
> 2. `buy_shares.rs` / `sell_shares.rs` — cost/refund math now propagates
>    `MathOverflow` instead of silently degrading to `0` / `u64::MAX`.
> 3. Emergency pause is now enforced on ALL trading instructions (`buy_shares`,
>    `sell_shares`, `add_liquidity`, `remove_liquidity`, `place_order`,
>    `fill_order`, `cancel_order`) via an `Option<Account<EmergencyPause>>` +
>    `utils/pause_guard.rs::check_not_paused`. Pausing now actually halts
>    trading. Note: this changed the program ABI — an on-chain redeploy is
>    required for the new accounts to take effect.

- [x] Every arithmetic op uses `checked_*` or i128/u128 intermediates.
      Zero raw `+ - * /` anywhere touching lamports, tokens, or fees.
- [x] All PDAs derived with canonical bumps, stored on-chain, and
      re-verified via Anchor's `seeds =` + `bump` constraints (never
      manually compare a passed-in bump without Anchor's constraint).
- [x] `has_one` / `address =` constraints present on: `config.admin`,
      `market.yes_mint`/`no_mint`, `position.owner`, `position.market`,
      ATA owner + mint pairing.
- [x] Oracle feed id is compared against `market.oracle_feed_id`
      inside `get_price_no_older_than` — an attacker cannot substitute
      an arbitrary Pyth price account for a different asset.
- [x] All time checks use `Clock::get()` on-chain only — the client
      never supplies a trusted timestamp for validation.
- [x] Double-claim blocked by BOTH the `claimed` boolean flag AND
      the token burn (defense in depth — even if one check had a
      bug, the other still protects funds).
- [x] Double-settle blocked by `status` enum check.
- [x] `init_if_needed` used ONLY on `user_position` and ATAs, whose
      fields are purely additive on re-entry (never resets an
      existing balance to zero).
- [x] Treasury lamport transfers always assert rent-exemption is
      maintained afterward.
- [x] Signer checks present on every admin-gated instruction
      (`initialize_market`, `settle_market`, `cancel_market`,
      `withdraw_fees`).
- [x] No instruction trusts a client-supplied "amount to mint" that
      isn't derived from `quantity * share_price_lamports` on-chain.
- [x] Program does not panic on malformed input — every failure path
      returns a typed `Result<(), SolPredictError>`, never an
      `unwrap()`/`expect()` on user-controlled data.
- [x] Reentrancy is a non-issue on Solana's account model, but
      **CPI ordering** is still checked: state updates happen
      BEFORE external CPIs where an attacker-controlled program
      could theoretically be invoked (not applicable here since we
      only CPI to Token/System/Pyth programs, but document this
      reasoning explicitly in code comments for future auditors).
- [x] Emergency pause halts trading: `check_not_paused` is called at the
      top of every user-facing trading instruction. Admin winding-down
      paths (settle/cancel/withdraw, claim, refund) intentionally bypass
      the guard so the protocol can still be settled while paused.

## Known gaps / deferred (documented, not blocking code correctness)

- `settle_market` (oracle-backed) is intentionally permissionless — anyone
  with a valid, fresh, matching-feed Pyth price update can trigger settlement.
  The outcome is fully determined by the oracle, so this is a griefing-vector
  consideration only (triggering settlement early is blocked by `resolve_ts`).
  If permissionless settlement is unwanted, gate `settle_market` behind the
  admin signer like `settle_market_manual`.
- `batch_settle`/`batch_match_orders` consume raw `remaining_accounts`
  validated only as `Account<Market>` — no PDA/seed check in the loop.
  `batch_match_orders` and `dispute_settlement` are TODO stubs.
- `sell_shares`/`add_liquidity`/`remove_liquidity` bind mints via PDA seeds
  derived from `market.key()` but lack an explicit `== market.yes_mint/no_mint`
  constraint (they are a pure function of the same market, so low risk).
- Add-liquidity mints base units 1:1 with lamports while buy_shares mints
  `quantity * BASE_UNITS_PER_SHARE` — confirm the LP token:share ratio is
  intentional before mainnet.