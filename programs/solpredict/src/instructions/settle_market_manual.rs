use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::MarketSettled;
use crate::state::{Category, Config, Market, MarketStatus, WinningOutcome};
use crate::utils::payout_math;

#[derive(Accounts)]
pub struct SettleMarketManual<'info> {
    pub admin: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ SolPredictError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
}

pub fn handler(ctx: Context<SettleMarketManual>, outcome: u8) -> Result<()> {
    let market = &ctx.accounts.market;
    let clock = Clock::get()?;

    // Block oracle-settleable categories — they must use settle_market
    require!(
        market.category != Category::Crypto,
        SolPredictError::UseOracleSettlement
    );

    // Must be Open
    require!(
        market.status == MarketStatus::Open,
        SolPredictError::AlreadySettled
    );

    // Must be past resolve_ts
    require!(
        clock.unix_timestamp >= market.resolve_ts,
        SolPredictError::TooEarlyToSettle
    );

    // Decode outcome: 1 = Yes, 2 = No
    let winning_outcome = match outcome {
        1 => WinningOutcome::Yes,
        2 => WinningOutcome::No,
        _ => return err!(SolPredictError::InvalidOutcome),
    };

    // One-sided check: if winning side has zero supply, auto-cancel
    let winning_supply = match winning_outcome {
        WinningOutcome::Yes => market.yes_supply,
        WinningOutcome::No => market.no_supply,
        WinningOutcome::Unset => 0,
    };

    let market = &mut ctx.accounts.market;

    if winning_supply == 0 {
        market.status = MarketStatus::Cancelled;
        market.settled_at = clock.unix_timestamp;
        market.settled_price = 0;
        market.settled_expo = 0;

        emit!(MarketSettled {
            market_id: market.market_id,
            winning_outcome: winning_outcome as u8,
            settled_price: 0,
            total_payout_pool: 0,
        });

        return Ok(());
    }

    // Compute fee and payout pool (same math as settle_market)
    let total_pool = market.yes_pool_lamports
        .checked_add(market.no_pool_lamports)
        .ok_or(SolPredictError::MathOverflow)?;

    let losing_pool = match winning_outcome {
        WinningOutcome::Yes => market.no_pool_lamports,
        WinningOutcome::No => market.yes_pool_lamports,
        WinningOutcome::Unset => 0,
    };

    let fee = payout_math::calculate_fee(losing_pool, ctx.accounts.config.fee_bps)?;

    let total_payout_pool = total_pool
        .checked_sub(fee)
        .ok_or(SolPredictError::MathOverflow)?;

    market.status = MarketStatus::Settled;
    market.winning_outcome = winning_outcome;
    market.settled_price = 0;
    market.settled_expo = 0;
    market.settled_at = clock.unix_timestamp;
    market.fee_collected = fee;
    market.total_payout_pool = total_payout_pool;

    emit!(MarketSettled {
        market_id: market.market_id,
        winning_outcome: winning_outcome as u8,
        settled_price: 0,
        total_payout_pool,
    });

    msg!(
        "Market {} manually settled: winner={:?}, payout_pool={}, fee={}",
        market.market_id,
        winning_outcome,
        total_payout_pool,
        fee
    );

    Ok(())
}
