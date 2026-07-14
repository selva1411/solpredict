# SOLPredict Test Matrix

## Program Verification Matrix

| Instruction / Component | Test Case | Expected Outcome | Type |
|---|---|---|---|
| initialize_config | Valid inputs | Config PDA initialized with correct admin and fee_bps | Integration |
| initialize_config | Double-init attempt | Fails with AccountAlreadyExists | Integration |
| initialize_config | Fee exceeds 10% (1000 bps) | Fails with FeeTooHigh | Integration |
| initialize_market | Admin signatures | Valid config admin creates market. Non-admin fails with Unauthorized | Integration |
| initialize_market | Expired timings | end_ts in the past or resolve_ts < end_ts fails with InvalidEndTime | Integration |
| initialize_market | Constraint checks | String lengths verified (Question ≤ 200, Desc ≤ 400). Min share price check | Integration |
| buy_shares | Valid purchase (YES/NO) | System transfer from buyer to Treasury. YES/NO minting to ATA. Pool size increases | Integration |
| buy_shares | Market expired / closed | Purchase fails if block time ≥ end_ts or status != Open | Integration |
| buy_shares | Quantity boundaries | Quantity ≤ 0 or > MAX_SHARES_PER_TX fails with InvalidQuantity | Integration |
| settle_market | Resolve timestamp | Settle attempt before resolve_ts fails with TooEarlyToSettle | Integration |
| settle_market | Oracle validation | Stale prices rejected. Wrong feed ID rejected. Low-confidence rejected | Integration |
| settle_market | Exponent scaling | Normalizes difference between price and target exponents using i128 math | Integration / Unit |
| settle_market | One-sided auto-cancel | Settlement where winner supply is zero transitions status to Cancelled | Integration |
| claim_rewards | Pro-rata math | Split payouts correctly. Burn winning tokens. Direct lamports transfer | Integration |
| claim_rewards | Double claim check | Second claim fails with AlreadyClaimed. Losers claim fails with NothingToClaim | Integration |
| cancel_market | Admin-only cancellation | Open market cancels. Settle/Cancelled state rejects cancellation | Integration |
| claim_refund | Exact SOL returned | Cancelled market refund returns exact deposit amount. Burns YES and NO tokens | Integration |
| withdraw_fees | Protocol fees | Admin withdraws fee_collected from settled market. FeeAlreadyWithdrawn prevents reuse | Integration |

## Frontend Coverage Requirements

- **Wallet Flow**: Devnet connection, signature mapping, error toasts.
- **Form State**: Buy sharesCost estimation, validation guards, loading spin.
- **Responsiveness**: Mobile layouts without heavy 3D scenes.
- **Visuals**: Neon observatory styling, countdown timing updates.
