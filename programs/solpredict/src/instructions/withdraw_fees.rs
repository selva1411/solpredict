use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::FeesWithdrawn;
use crate::state::{Config, Market, MarketStatus};

/// Accounts for the `withdraw_fees` instruction.
///
/// Admin-only. Withdraws collected protocol fees from a settled market's
/// treasury. One-time withdrawal per market (double-withdraw guard).
#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    /// Admin signer — must match `config.admin`.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Config PDA — to verify admin identity.
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ SolPredictError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    /// Market — must be Settled, fee not yet withdrawn.
    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Settled @ SolPredictError::MarketNotSettled,
        constraint = !market.fee_withdrawn @ SolPredictError::FeeAlreadyWithdrawn,
    )]
    pub market: Account<'info, Market>,

    /// Treasury PDA — fee source.
    /// CHECK: Validated by seeds constraint.
    #[account(
        mut,
        seeds = [TREASURY_SEED, market.key().as_ref()],
        bump = market.treasury_bump,
    )]
    pub treasury: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Handler for `withdraw_fees`.
///
/// Transfers `market.fee_collected` lamports from treasury to admin.
/// Sets `fee_withdrawn = true` to prevent double withdrawal.
pub fn handler(ctx: Context<WithdrawFees>) -> Result<()> {
    let fee_amount = ctx.accounts.market.fee_collected;

    // Transfer fee lamports treasury → admin via CPI (treasury is a SystemAccount)
    let market_key = ctx.accounts.market.key();
    let treasury_bump = ctx.accounts.market.treasury_bump;
    let seeds = &[
        TREASURY_SEED,
        market_key.as_ref(),
        &[treasury_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.treasury.to_account_info(),
            to: ctx.accounts.admin.to_account_info(),
        },
        signer_seeds,
    );
    anchor_lang::system_program::transfer(cpi_ctx, fee_amount)?;

    // Verify treasury retains rent-exempt minimum or is completely empty
    let treasury_info = ctx.accounts.treasury.to_account_info();
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(0);
    let balance = treasury_info.lamports();
    require!(
        balance >= min_balance || balance == 0,
        SolPredictError::TreasuryInsufficient
    );

    // Mark fee as withdrawn
    ctx.accounts.market.fee_withdrawn = true;

    // Emit event
    emit!(FeesWithdrawn {
        market_id: ctx.accounts.market.market_id,
        amount: fee_amount,
    });

    msg!(
        "Withdrew {} lamports in fees for market {}",
        fee_amount,
        ctx.accounts.market.market_id
    );

    Ok(())
}
