# Instruction: `withdraw_fees()`

## Accounts
`admin` (signer, == config.admin), `market` (mut), `treasury` (mut).

## Logic
1. `require!(admin.key() == config.admin, Unauthorized)`.
2. `require!(market.status == Settled, MarketNotSettled)`.
3. `require!(!market.fee_withdrawn, FeeAlreadyWithdrawn)`.
4. Transfer `market.fee_collected` lamports treasury → admin
   (same lamport-manipulation + rent-exempt post-check pattern).
5. `market.fee_withdrawn = true`.
6. `emit!(FeesWithdrawn { market_id, amount: market.fee_collected })`.

## Acceptance Tests
- Second withdrawal attempt → `FeeAlreadyWithdrawn`.
- Withdrawal before settlement → `MarketNotSettled`.
- Non-admin attempt → `Unauthorized`.
- Admin balance increases by exactly `fee_collected`.