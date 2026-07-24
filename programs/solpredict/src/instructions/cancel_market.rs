use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::MarketCancelled;
use crate::state::{Config, Market, MarketStatus};

#[derive(Accounts)]
pub struct CancelMarket<'info> {
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
        constraint = market.status == MarketStatus::Open @ SolPredictError::MarketNotOpen,
    )]
    pub market: Account<'info, Market>,
}

pub fn handler(ctx: Context<CancelMarket>, reason: String) -> Result<()> {
    require!(reason.len() <= MAX_DESCRIPTION_LEN, SolPredictError::InvalidDescription);

    let market_id = ctx.accounts.market.market_id;
    let admin_key = ctx.accounts.admin.key();

    ctx.accounts.market.reentrancy_lock.acquire(&crate::ID)?;

    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::Cancelled;

    ctx.accounts.market.reentrancy_lock.release();

    emit!(MarketCancelled { market_id, cancelled_by: admin_key, reason });

    Ok(())
}