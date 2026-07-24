use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::EmergencyWithdraw;
use crate::state::{Config, EmergencyPause, Market, MarketStatus};

#[derive(Accounts)]
pub struct EmergencyWithdrawAccounts<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, market.key().as_ref()],
        bump = market.treasury_bump,
    )]
    pub treasury: SystemAccount<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ SolPredictError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [PAUSE_SEED],
        bump = emergency_pause.bump,
    )]
    pub emergency_pause: Account<'info, EmergencyPause>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<EmergencyWithdrawAccounts>) -> Result<()> {
    let market = &mut ctx.accounts.market;

    let is_paused = ctx.accounts.emergency_pause.paused;
    let is_settled = market.status == MarketStatus::Settled;

    require!(is_paused || is_settled, SolPredictError::MarketNotSettled);

    let treasury_balance = ctx.accounts.treasury.lamports();
    require!(treasury_balance > 0, SolPredictError::NoFeesToWithdraw);

    let withdraw_amount = if is_settled {
        let unclaimed = market
            .total_payout_pool
            .saturating_sub(market.total_claimed)
            .saturating_add(market.fee_collected);
        unclaimed.min(treasury_balance)
    } else {
        treasury_balance
    };

    let market_id = market.market_id;
    let treasury_bump = market.treasury_bump;
    let market_key = market.key();
    let admin_key = ctx.accounts.admin.key();

    market.reentrancy_lock.acquire(&crate::ID)?;

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: ctx.accounts.admin.to_account_info(),
            },
            &[&[TREASURY_SEED, market_key.as_ref(), &[treasury_bump]]],
        ),
        withdraw_amount,
    )?;

    market.reentrancy_lock.release();

    emit!(EmergencyWithdraw {
        market_id,
        admin: admin_key,
        amount: withdraw_amount,
        reason: if is_paused { "emergency_pause".to_string() } else { "settled_drain".to_string() },
    });

    Ok(())
}