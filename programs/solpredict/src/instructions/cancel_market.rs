use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::MarketCancelled;
use crate::state::{Config, Market, MarketStatus};

/// Accounts for the `cancel_market` instruction.
///
/// Admin-only. Used when an event is ambiguous, oracle is down long-term,
/// or settlement auto-detects a one-sided market.
#[derive(Accounts)]
pub struct CancelMarket<'info> {
    /// Admin signer — must match `config.admin`.
    pub admin: Signer<'info>,

    /// Config PDA — to verify admin identity.
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ SolPredictError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    /// Market PDA — must be Open (can't cancel something already settled).
    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Open @ SolPredictError::MarketNotOpen,
    )]
    pub market: Account<'info, Market>,
}

/// Handler for `cancel_market`.
///
/// Transitions market from Open → Cancelled. Users can then use
/// `claim_refund` to get their exact stake back (no fee taken on cancellation).
pub fn handler(ctx: Context<CancelMarket>, reason: String) -> Result<()> {
    require!(reason.len() <= MAX_DESCRIPTION_LEN, SolPredictError::InvalidDescription);

    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::Cancelled;

    emit!(MarketCancelled {
        market_id: market.market_id,
        cancelled_by: ctx.accounts.admin.key(),
        reason: reason.clone(),
    });

    msg!("Market {} cancelled by admin. Reason: {}", market.market_id, reason);

    Ok(())
}
