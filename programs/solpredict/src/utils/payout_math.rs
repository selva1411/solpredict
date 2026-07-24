use anchor_lang::prelude::*;

use crate::errors::SolPredictError;

/// Flat-cost: quantity × price, checked for overflow.
pub fn calculate_cost(quantity: u64, share_price_lamports: u64) -> Result<u64> {
    quantity
        .checked_mul(share_price_lamports)
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