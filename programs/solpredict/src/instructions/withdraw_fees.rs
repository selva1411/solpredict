use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::FeesWithdrawn;
use crate::state::{Config, Market, MarketStatus};

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(mut)]
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
        constraint = market.status == MarketStatus::Settled @ SolPredictError::MarketNotSettled,
        constraint = !market.fee_withdrawn @ SolPredictError::FeeAlreadyWithdrawn,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, market.key().as_ref()],
        bump = market.treasury_bump,
    )]
    pub treasury: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawFees>) -> Result<()> {
    require!(!ctx.accounts.market.fee_withdrawn, SolPredictError::FeeAlreadyWithdrawn);
    require!(ctx.accounts.market.fee_collected > 0, SolPredictError::NoFeesToWithdraw);
    require!(ctx.accounts.market.status == MarketStatus::Settled, SolPredictError::MarketNotSettled);

    let fee_amount = ctx.accounts.market.fee_collected;

    let market_key = ctx.accounts.market.key();
    let treasury_bump = ctx.accounts.market.treasury_bump;
    let seeds = &[TREASURY_SEED, market_key.as_ref(), &[treasury_bump]];
    let signer_seeds = &[&seeds[..]];

    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: ctx.accounts.admin.to_account_info(),
            },
            signer_seeds,
        ),
        fee_amount,
    )?;

    let treasury_info = ctx.accounts.treasury.to_account_info();
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(0);
    let balance = treasury_info.lamports();
    require!(balance >= min_balance || balance == 0, SolPredictError::TreasuryInsufficient);

    let market_id = ctx.accounts.market.market_id;

    ctx.accounts.market.reentrancy_lock.acquire(&crate::ID)?;

    let market = &mut ctx.accounts.market;
    market.fee_withdrawn = true;

    ctx.accounts.market.reentrancy_lock.release();

    emit!(FeesWithdrawn { market_id, amount: fee_amount });

    Ok(())
}