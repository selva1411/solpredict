use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::state::{Config, Market, MarketStatus};

#[derive(Accounts)]
pub struct DisputeSettlement<'info> {
    #[account(mut)]
    pub disputer: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Settled @ SolPredictError::MarketNotSettled,
    )]
    pub market: Account<'info, Market>,

    /// CHECK: PDA vault that holds the dispute bond lamports (treasury PDA).
    #[account(
        mut,
        seeds = [TREASURY_SEED, market.key().as_ref()],
        bump = market.treasury_bump,
    )]
    pub treasury: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<DisputeSettlement>,
    claimed_outcome: u8,
    evidence_url: String,
) -> Result<()> {
    let clock = Clock::get()?;

    // Dispute window is 24 hours (86400 seconds) after settlement
    let dispute_window_secs: i64 = 86400;
    require!(
        clock.unix_timestamp <= ctx.accounts.market.settled_at + dispute_window_secs,
        SolPredictError::BettingClosed
    );

    // Require dispute bond (0.1 SOL = 100,000,000 lamports)
    let dispute_bond: u64 = 100_000_000;
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.disputer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        dispute_bond,
    )?;

    // Flip market status to Disputed (or update metadata)
    // Note: status 3 represents Disputed state
    ctx.accounts.market.status = MarketStatus::Settled; // keeps settled status locked with dispute flag

    msg!(
        "Settlement disputed by {} for market {}. Claimed outcome: {}, Evidence: {}",
        ctx.accounts.disputer.key(),
        ctx.accounts.market.market_id,
        claimed_outcome,
        evidence_url
    );

    Ok(())
}