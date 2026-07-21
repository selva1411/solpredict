use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::PositionClosed;
use crate::state::{Market, MarketStatus, UserPosition};

/// Accounts for the `close_position` instruction.
///
/// Allows any user (including losing predictors) to close their UserPosition PDA
/// after market settlement or cancellation and recover their ~0.0015 SOL rent deposit.
#[derive(Accounts)]
pub struct ClosePosition<'info> {
    /// Position owner reclaiming rent.
    #[account(mut)]
    pub user: Signer<'info>,

    /// Market — must NOT be Open (trading must be ended/settled/cancelled).
    #[account(
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.status != MarketStatus::Open @ SolPredictError::MarketNotEnded,
    )]
    pub market: Account<'info, Market>,

    /// UserPosition PDA — closed and rent sent back to user.
    #[account(
        mut,
        close = user,
        seeds = [POSITION_SEED, market.key().as_ref(), user.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.owner == user.key() @ SolPredictError::Unauthorized,
        constraint = user_position.market == market.key() @ SolPredictError::Unauthorized,
    )]
    pub user_position: Account<'info, UserPosition>,

    pub system_program: Program<'info, System>,
}

/// Handler for `close_position`.
///
/// Closes the `UserPosition` PDA account and transfers the rent-exempt SOL deposit
/// back to the user's wallet.
pub fn handler(ctx: Context<ClosePosition>) -> Result<()> {
    let rent_reclaimed = ctx.accounts.user_position.to_account_info().lamports();

    emit!(PositionClosed {
        market_id: ctx.accounts.market.market_id,
        user: ctx.accounts.user.key(),
        rent_reclaimed,
    });

    msg!(
        "Closed UserPosition PDA for market {}. Reclaimed {} lamports rent for user {}",
        ctx.accounts.market.market_id,
        rent_reclaimed,
        ctx.accounts.user.key()
    );

    Ok(())
}
