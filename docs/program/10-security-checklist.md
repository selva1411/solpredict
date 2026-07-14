# Security Checklist — Verify Every Item Before Phase 5 Sign-off

- [ ] Every arithmetic op uses `checked_*` or i128/u128 intermediates.
      Zero raw `+ - * /` anywhere touching lamports, tokens, or fees.
- [ ] All PDAs derived with canonical bumps, stored on-chain, and
      re-verified via Anchor's `seeds =` + `bump` constraints (never
      manually compare a passed-in bump without Anchor's constraint).
- [ ] `has_one` / `address =` constraints present on: `config.admin`,
      `market.yes_mint`/`no_mint`, `position.owner`, `position.market`,
      ATA owner + mint pairing.
- [ ] Oracle feed id is compared against `market.oracle_feed_id`
      inside `get_price_no_older_than` — an attacker cannot substitute
      an arbitrary Pyth price account for a different asset.
- [ ] All time checks use `Clock::get()` on-chain only — the client
      never supplies a trusted timestamp for validation.
- [ ] Double-claim blocked by BOTH the `claimed` boolean flag AND
      the token burn (defense in depth — even if one check had a
      bug, the other still protects funds).
- [ ] Double-settle blocked by `status` enum check.
- [ ] `init_if_needed` used ONLY on `user_position` and ATAs, whose
      fields are purely additive on re-entry (never resets an
      existing balance to zero).
- [ ] Treasury lamport transfers always assert rent-exemption is
      maintained afterward.
- [ ] Signer checks present on every admin-gated instruction
      (`initialize_market`, `settle_market`, `cancel_market`,
      `withdraw_fees`).
- [ ] No instruction trusts a client-supplied "amount to mint" that
      isn't derived from `quantity * share_price_lamports` on-chain.
- [ ] Program does not panic on malformed input — every failure path
      returns a typed `Result<(), SolPredictError>`, never an
      `unwrap()`/`expect()` on user-controlled data.
- [ ] Reentrancy is a non-issue on Solana's account model, but
      **CPI ordering** is still checked: state updates happen
      BEFORE external CPIs where an attacker-controlled program
      could theoretically be invoked (not applicable here since we
      only CPI to Token/System/Pyth programs, but document this
      reasoning explicitly in code comments for future auditors).