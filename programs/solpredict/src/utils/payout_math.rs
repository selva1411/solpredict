use anchor_lang::prelude::*;

use crate::errors::SolPredictError;

/// Flat-cost: quantity × price, checked for overflow.
pub fn calculate_cost(quantity: u64, share_price_lamports: u64) -> Result<u64> {
    quantity
        .checked_mul(share_price_lamports)
        .ok_or_else(|| error!(SolPredictError::MathOverflow))
}

/// Flat-cost with the protocol fee applied on top (BUY path).
///
/// The AMM curve charges the fee inside its quote; the flat linear-minting
/// path used to charge none — early traders in a one-sided market traded
/// fee-free. Mirrors the curve's convention: the buyer pays fee_bps on top
/// of the base price, so `cost = qty × price × 10_000 / (10_000 − fee_bps)`.
pub fn calculate_cost_with_fee(
    quantity: u64,
    share_price_lamports: u64,
    fee_bps: u16,
) -> Result<u128> {
    require!(fee_bps < 10_000, SolPredictError::MathOverflow);
    let base = calculate_cost(quantity, share_price_lamports)? as u128;
    base.checked_mul(10_000u128)
        .ok_or_else(|| error!(SolPredictError::MathOverflow))?
        .checked_div((10_000u128)
            .checked_sub(fee_bps as u128)
            .ok_or_else(|| error!(SolPredictError::MathOverflow))?)
        .ok_or_else(|| error!(SolPredictError::MathOverflow))
}

/// Flat-proceeds with the protocol fee applied (SELL path).
///
/// `refund = qty × price × (10_000 − fee_bps) / 10_000` — the seller pays
/// the fee out of their proceeds, matching the curve's sell-side behavior.
pub fn calculate_proceeds_with_fee(
    quantity: u64,
    share_price_lamports: u64,
    fee_bps: u16,
) -> Result<u128> {
    let base = calculate_cost(quantity, share_price_lamports)? as u128;
    base.checked_mul((10_000u128)
        .checked_sub(fee_bps as u128)
        .ok_or_else(|| error!(SolPredictError::MathOverflow))?)
        .ok_or_else(|| error!(SolPredictError::MathOverflow))?
        .checked_div(10_000u128)
        .ok_or_else(|| error!(SolPredictError::MathOverflow))
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