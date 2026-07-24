use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::MarketSettledManual;
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

    require!(ctx.accounts.admin.key() == ctx.accounts.config.admin, SolPredictError::Unauthorized);
    require!(market.status == MarketStatus::Open, SolPredictError::AlreadySettled);
    require!(clock.unix_timestamp >= market.resolve_ts, SolPredictError::MarketNotEnded);
    require!(market.category != Category::Crypto, SolPredictError::UsePythForCrypto);
    require!(market.yes_pool_lamports > 0 || market.no_pool_lamports > 0, SolPredictError::EmptyPool);

    let winning_outcome = match outcome {
        1 => WinningOutcome::Yes,
        2 => WinningOutcome::No,
        _ => return err!(SolPredictError::InvalidOutcome),
    };

    let market_id = market.market_id;

    let total_pool = market.yes_pool_lamports
        .checked_add(market.no_pool_lamports)
        .ok_or(SolPredictError::MathOverflow)?;

    let losing_pool = match winning_outcome {
        WinningOutcome::Yes => market.no_pool_lamports,
        WinningOutcome::No => market.yes_pool_lamports,
        WinningOutcome::Unset => 0,
    };

    let fee = payout_math::calculate_fee(losing_pool, ctx.accounts.config.fee_bps)?;
    let total_payout_pool = total_pool.checked_sub(fee).ok_or(SolPredictError::MathOverflow)?;

    ctx.accounts.market.reentrancy_lock.acquire(&crate::ID)?;

    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::Settled;
    market.winning_outcome = winning_outcome;
    market.fee_collected = fee;
    market.total_payout_pool = total_payout_pool;
    market.settled_at = clock.unix_timestamp;

    ctx.accounts.market.reentrancy_lock.release();

    emit!(MarketSettledManual {
        market_id,
        winning_outcome: outcome,
        fee_collected: fee,
        total_payout_pool,
        settled_by: ctx.accounts.admin.key(),
        settled_at: clock.unix_timestamp,
    });

    Ok(())
}