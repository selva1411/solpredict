use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::MarketSettled;
use crate::state::{Config, Market, MarketStatus, WinningOutcome};
use crate::utils::{oracle, payout_math};

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    /// Program admin — the only party allowed to settle. Prevents third
    /// parties from front-running settlement with a stale oracle price.
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ SolPredictError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    /// CHECK: Validated inside oracle::validate_and_read_price which parses
    /// the account data, verifies feed ID, staleness, and confidence.
    pub price_update: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<SettleMarket>) -> Result<()> {
    let market = &ctx.accounts.market;
    let clock = Clock::get()?;

    require!(market.oracle_feed_id != [0u8; 32], SolPredictError::UseManualSettlement);
    require!(market.status == MarketStatus::Open, SolPredictError::AlreadySettled);
    require!(clock.unix_timestamp >= market.end_ts || clock.unix_timestamp >= market.resolve_ts, SolPredictError::TooEarlyToSettle);

    let validated_price = oracle::validate_and_read_price(
        &ctx.accounts.price_update.to_account_info(), &clock, &market.oracle_feed_id, MAX_STALENESS_SECS,
    )?;

    let yes_wins = oracle::compare_prices(
        validated_price.price, validated_price.expo, market.target_price, market.target_expo, market.comparison,
    )?;

    let winning_outcome = if yes_wins { WinningOutcome::Yes } else { WinningOutcome::No };

    let winning_supply = match winning_outcome {
        WinningOutcome::Yes => market.yes_supply,
        WinningOutcome::No => market.no_supply,
        WinningOutcome::Unset => 0,
    };

    let market_id = market.market_id;
    let settled_price = validated_price.price;
    let settled_expo = validated_price.expo;

    if winning_supply == 0 {
        ctx.accounts.market.reentrancy_lock.acquire(&crate::ID)?;
        let market = &mut ctx.accounts.market;
        market.status = MarketStatus::Cancelled;
        market.settled_price = settled_price;
        market.settled_expo = settled_expo;
        market.settled_at = clock.unix_timestamp;
        ctx.accounts.market.reentrancy_lock.release();

        emit!(MarketSettled { market_id, winning_outcome: winning_outcome as u8, settled_price, total_payout_pool: 0 });
        return Ok(());
    }

    let yes_pool = market.yes_pool_lamports;
    let no_pool = market.no_pool_lamports;
    let total_pool = yes_pool.checked_add(no_pool).ok_or(SolPredictError::MathOverflow)?;

    let losing_pool = match winning_outcome {
        WinningOutcome::Yes => no_pool,
        WinningOutcome::No => yes_pool,
        WinningOutcome::Unset => 0,
    };

    let fee = payout_math::calculate_fee(losing_pool, ctx.accounts.config.fee_bps)?;
    let total_payout_pool = total_pool.checked_sub(fee).ok_or(SolPredictError::MathOverflow)?;

    ctx.accounts.market.reentrancy_lock.acquire(&crate::ID)?;

    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::Settled;
    market.winning_outcome = winning_outcome;
    market.settled_price = settled_price;
    market.settled_expo = settled_expo;
    market.settled_at = clock.unix_timestamp;
    market.fee_collected = fee;
    market.total_payout_pool = total_payout_pool;

    ctx.accounts.market.reentrancy_lock.release();

    emit!(MarketSettled { market_id, winning_outcome: winning_outcome as u8, settled_price, total_payout_pool });

    Ok(())
}