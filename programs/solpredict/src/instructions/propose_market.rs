use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::{MarketProposalProcessed, MarketProposed};
use crate::state::{Config, MarketProposal, ProposalStatus};

#[derive(Accounts)]
pub struct ProposeMarket<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = proposer,
        space = MarketProposal::LEN,
        seeds = [PROPOSAL_SEED, config.market_count.to_le_bytes().as_ref()],
        bump,
    )]
    pub proposal: Account<'info, MarketProposal>,

    /// CHECK: PDA vault that holds the proposal bond lamports.
    #[account(
        mut,
        seeds = [PROPOSAL_VAULT_SEED, config.market_count.to_le_bytes().as_ref()],
        bump,
    )]
    pub proposal_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ProposeMarket>,
    question: String,
    description: String,
    category: u8,
    oracle_feed_id: [u8; 32],
    target_price: i64,
    target_expo: i32,
    comparison: u8,
    end_ts: i64,
    resolve_ts: i64,
    share_price_lamports: u64,
) -> Result<()> {
    let clock = Clock::get()?;

    require!(
        question.len() >= 10 && question.len() <= MAX_QUESTION_LEN,
        SolPredictError::InvalidQuestion
    );
    require!(
        description.len() <= MAX_DESCRIPTION_LEN,
        SolPredictError::InvalidDescription
    );
    require!(end_ts > clock.unix_timestamp + 3600, SolPredictError::EndTimeTooSoon);
    require!(end_ts <= clock.unix_timestamp + 365 * 24 * 3600, SolPredictError::EndTimeTooFar);
    require!(resolve_ts >= end_ts, SolPredictError::ResolveTooSoon);
    require!(
        share_price_lamports >= MIN_SHARE_PRICE,
        SolPredictError::SharePriceTooLow
    );

    let proposal_id = ctx.accounts.config.market_count;
    let bond = MarketProposal::MIN_BOND_LAMPORTS;

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.proposer.to_account_info(),
                to: ctx.accounts.proposal_vault.to_account_info(),
            },
        ),
        bond,
    )?;

    let proposal = &mut ctx.accounts.proposal;
    proposal.proposal_id = proposal_id;
    proposal.proposer = ctx.accounts.proposer.key();
    proposal.question = question.clone();
    proposal.description = description;
    proposal.category = category;
    proposal.oracle_feed_id = oracle_feed_id;
    proposal.target_price = target_price;
    proposal.target_expo = target_expo;
    proposal.comparison = comparison;
    proposal.end_ts = end_ts;
    proposal.resolve_ts = resolve_ts;
    proposal.share_price_lamports = share_price_lamports;
    proposal.bond_lamports = bond;
    proposal.status = ProposalStatus::Pending;
    proposal.created_at = clock.unix_timestamp;
    proposal.bump = ctx.bumps.proposal;

    ctx.accounts.config.market_count = ctx
        .accounts
        .config
        .market_count
        .checked_add(1)
        .ok_or(SolPredictError::MathOverflow)?;

    emit!(MarketProposed {
        proposal_id,
        proposer: ctx.accounts.proposer.key(),
        question,
        bond_lamports: bond,
        created_at: clock.unix_timestamp,
    });

    Ok(())
}