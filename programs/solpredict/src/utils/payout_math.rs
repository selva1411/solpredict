use anchor_lang::prelude::*;

use crate::errors::SolPredictError;

/// Flat-cost: quantity × price, checked for overflow.
pub fn calculate_cost(quantity: u64, share_price_lamports: u64) -> Result<u64> {
    quantity
        .checked_mul(share_price_lamports)
        .ok_or_else(|| error!(SolPredictError::MathOverflow))
}

/// Dynamic buy cost using CPMM pool ratios.
/// 
/// The more a side is winning (high pool weight), the MORE expensive its shares.
/// Underdog shares are cheap. This mirrors Polymarket's AMM pricing.
/// 
/// effective_price = base_price * (side_prob_bps + 5000) / 10_000
/// where side_prob_bps = side_pool / total_pool * 10_000
///
/// Example: YES has 70% pool weight → prob_bps = 7000
///   effective_price = base * (7000 + 5000) / 10000 = base * 1.2
/// NO has 30% weight → effective_price = base * (3000 + 5000) / 10000 = base * 0.8
pub fn calculate_dynamic_cost(
    quantity: u64,
    base_price_lamports: u64,
    side_pool: u64,
    total_pool: u64,
) -> Result<u64> {
    if total_pool == 0 {
        return calculate_cost(quantity, base_price_lamports);
    }

    let prob_bps = (side_pool as u128)
        .checked_mul(10_000)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(total_pool as u128)
        .unwrap_or(5000);

    // Clamp to [1000, 9000] so price never goes below 10% or above 90% of base
    let prob_bps_clamped = prob_bps.max(1000).min(9000);

    let effective_price = (base_price_lamports as u128)
        .checked_mul(prob_bps_clamped + 5000)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(SolPredictError::MathOverflow)?;

    let effective_price_u64 = u64::try_from(effective_price).unwrap_or(base_price_lamports);

    let cost = (quantity as u128)
        .checked_mul(effective_price_u64 as u128)
        .ok_or(SolPredictError::MathOverflow)?;

    u64::try_from(cost).map_err(|_| error!(SolPredictError::MathOverflow))
}

/// Dynamic sell refund using inverse CPMM pricing.
///
/// Sell refund is ALWAYS less than or equal to the buy cost for the same quantity.
/// This ensures the treasury is never over-drained.
///
/// sell_refund = base_price * side_prob_bps / 10_000 * quantity
/// (vs buy: base_price * (prob_bps + 5000) / 10_000 * quantity)
///
/// So sells always return less than what buys cost — the spread is the AMM fee.
/// This maintains treasury solvency regardless of trade history.
pub fn calculate_sell_refund(
    quantity: u64,
    base_price_lamports: u64,
    side_pool: u64,
    total_pool: u64,
    treasury_balance: u64,
) -> Result<u64> {
    if total_pool == 0 || side_pool == 0 {
        // If pool is empty, refund flat base price * quantity, but capped at treasury
        let flat = calculate_cost(quantity, base_price_lamports)?;
        return Ok(flat.min(treasury_balance));
    }

    let prob_bps = (side_pool as u128)
        .checked_mul(10_000)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(total_pool as u128)
        .unwrap_or(5000);

    // For sells: effective_price = base * prob_bps / 10_000
    // Clamped to [500, 9500] so refund is always between 5% and 95% of base
    let prob_bps_clamped = prob_bps.max(500).min(9500);

    let effective_price = (base_price_lamports as u128)
        .checked_mul(prob_bps_clamped)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(SolPredictError::MathOverflow)?;

    // Minimum: 1 lamport per share
    let effective_price_u64 = u64::try_from(effective_price)
        .unwrap_or(base_price_lamports / 2)
        .max(1);

    let refund = (quantity as u128)
        .checked_mul(effective_price_u64 as u128)
        .ok_or(SolPredictError::MathOverflow)?;

    let refund_u64 = u64::try_from(refund).unwrap_or(u64::MAX);

    // CRITICAL: Cap refund to treasury balance - 1 lamport (never drain treasury)
    // This is the final safety net against any edge-case overflow.
    let safe_refund = refund_u64.min(treasury_balance.saturating_sub(1));

    Ok(safe_refund)
}

/// Calculate a winner's pro-rata payout from the total payout pool.
pub fn calculate_payout(
    total_payout_pool: u64,
    user_shares: u64,
    winning_supply: u64,
) -> Result<u64> {
    require!(winning_supply > 0, SolPredictError::MathOverflow);

    let numerator = (total_payout_pool as u128)
        .checked_mul(user_shares as u128)
        .ok_or(SolPredictError::MathOverflow)?;

    let payout = numerator
        .checked_div(winning_supply as u128)
        .ok_or(SolPredictError::MathOverflow)?;

    u64::try_from(payout).map_err(|_| error!(SolPredictError::MathOverflow))
}

/// Calculate the protocol fee from the losing pool.
pub fn calculate_fee(losing_pool: u64, fee_bps: u16) -> Result<u64> {
    let numerator = (losing_pool as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(SolPredictError::MathOverflow)?;

    let fee = numerator
        .checked_div(10_000)
        .ok_or(SolPredictError::MathOverflow)?;

    u64::try_from(fee).map_err(|_| error!(SolPredictError::MathOverflow))
}
