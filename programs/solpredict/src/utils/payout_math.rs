use crate::errors::SolPredictError;
use anchor_lang::prelude::*;

/// Calculate the cost of purchasing `quantity` shares at `share_price_lamports`.
///
/// Uses checked multiplication to prevent overflow. If quantity * price > u64::MAX,
/// returns MathOverflow instead of wrapping — critical for preventing
/// overflow-crafting attacks where an attacker tries to pay less than intended.
pub fn calculate_cost(quantity: u64, share_price_lamports: u64) -> Result<u64> {
    quantity
        .checked_mul(share_price_lamports)
        .ok_or_else(|| error!(SolPredictError::MathOverflow))
}

/// Calculate a winner's pro-rata payout from the total payout pool.
///
/// Formula: floor(total_payout_pool * user_shares / winning_supply)
///
/// Uses u128 intermediates to avoid overflow before narrowing back to u64.
/// Floor-rounded so the treasury is never over-drained — any dust remainder
/// stays in the treasury permanently, which is acceptable.
///
/// # Arguments
/// * `total_payout_pool` — total pool minus fee (computed at settlement)
/// * `user_shares` — user's token balance in base units (shares * 10^6)
/// * `winning_supply` — total supply of winning-side tokens in base units
pub fn calculate_payout(
    total_payout_pool: u64,
    user_shares: u64,
    winning_supply: u64,
) -> Result<u64> {
    // Guard against division by zero (should never happen if settlement logic
    // correctly handles one-sided markets, but defense in depth)
    require!(winning_supply > 0, SolPredictError::MathOverflow);

    // Use u128 to avoid overflow: total_payout_pool * user_shares can exceed u64::MAX
    // for large pools (e.g. 1000 SOL pool * 1M shares = 10^18 which > 2^63)
    let numerator = (total_payout_pool as u128)
        .checked_mul(user_shares as u128)
        .ok_or(SolPredictError::MathOverflow)?;

    let payout = numerator
        .checked_div(winning_supply as u128)
        .ok_or(SolPredictError::MathOverflow)?;

    // Narrow back to u64 — should always fit since payout ≤ total_payout_pool
    // which is a u64, but verify defensively
    u64::try_from(payout).map_err(|_| error!(SolPredictError::MathOverflow))
}

/// Calculate the protocol fee from the losing pool.
///
/// Formula: floor(losing_pool * fee_bps / 10_000)
///
/// Fee is taken from the losing pool ONLY (not the total pool).
/// Uses u128 intermediate since losing_pool * fee_bps could overflow u64
/// for very large pools (unlikely on devnet but correct by construction).
pub fn calculate_fee(losing_pool: u64, fee_bps: u16) -> Result<u64> {
    let numerator = (losing_pool as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(SolPredictError::MathOverflow)?;

    let fee = numerator
        .checked_div(10_000)
        .ok_or(SolPredictError::MathOverflow)?;

    u64::try_from(fee).map_err(|_| error!(SolPredictError::MathOverflow))
}
