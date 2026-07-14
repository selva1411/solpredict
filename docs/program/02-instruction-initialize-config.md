# Instruction: `initialize_config(fee_bps: u16)`

## Purpose
One-time bootstrap. Whoever calls this first becomes the permanent
admin for the whole program deployment.

## Accounts
| Account | Type | Notes |
|---|---|---|
| `admin` | Signer, mut | becomes `config.admin` |
| `config` | init, PDA `["config"]` | payer = admin |
| `system_program` | Program | |

## Logic (write as comments, then implement)
1. Anchor's `init` constraint already prevents double-initialization
   (fails if the account exists) — no extra check needed for that.
2. `require!(fee_bps <= 1000, ConfigError::FeeTooHigh)` — max 10%.
3. Set `config.admin = admin.key()`, `config.fee_bps = fee_bps`,
   `config.market_count = 0`, store bump.

## Acceptance Test
- Calling twice fails (second call errors on account-already-exists).
- `fee_bps = 1500` (15%) fails with `FeeTooHigh`.
- Successful call: `config.admin` matches caller, `market_count == 0`.