use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{Mint, Token};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::MarketProposalProcessed;
use crate::state::{
    Category, Comparison, Config, Market, MarketProposal, MarketStatus, ProposalStatus,
    WinningOutcome,
};

#[derive(Accounts)]
pub struct ApproveMarket<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ SolPredictError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [PROPOSAL_SEED, proposal.proposal_id.to_le_bytes().as_ref()],
        bump = proposal.bump,
        constraint = proposal.status == ProposalStatus::Pending @ SolPredictError::ProposalNotPending,
    )]
    pub proposal: Account<'info, MarketProposal>,

    /// CHECK: vault holding the proposal bond.
    #[account(
        mut,
        seeds = [PROPOSAL_VAULT_SEED, proposal.proposal_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub proposal_vault: SystemAccount<'info>,

    /// CHECK: proposer receives bond back.
    #[account(mut)]
    pub proposer: SystemAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = Market::LEN,
        seeds = [MARKET_SEED, proposal.proposal_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = admin,
        mint::decimals = SHARE_DECIMALS,
        mint::authority = market,
        seeds = [YES_MINT_SEED, market.key().as_ref()],
        bump,
    )]
    pub yes_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        mint::decimals = SHARE_DECIMALS,
        mint::authority = market,
        seeds = [NO_MINT_SEED, market.key().as_ref()],
        bump,
    )]
    pub no_mint: Account<'info, Mint>,

    /// CHECK: PDA that holds the market's SOL pool.
    #[account(
        seeds = [TREASURY_SEED, market.key().as_ref()],
        bump,
    )]
    pub treasury: SystemAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<ApproveMarket>) -> Result<()> {
    let proposal = &ctx.accounts.proposal;
    let config = &ctx.accounts.config;
    let clock = Clock::get()?;

    // 1. Validation checks (re-validate proposal data)
    require!(
        proposal.end_ts > clock.unix_timestamp,
        SolPredictError::InvalidEndTime
    );

    // 2. Return bond to proposer
    let vault_lamports = ctx.accounts.proposal_vault.lamports();
    let bond_return = vault_lamports.min(proposal.bond_lamports);
    if bond_return > 0 {
        let proposal_id_bytes = proposal.proposal_id.to_le_bytes();
        let vault_bump = ctx.bumps.proposal_vault;
        let seeds = &[PROPOSAL_VAULT_SEED, proposal_id_bytes.as_slice(), &[vault_bump]];
        let signer_seeds = &[&seeds[..]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.proposal_vault.to_account_info(),
                    to: ctx.accounts.proposer.to_account_info(),
                },
                signer_seeds,
            ),
            bond_return,
        )?;
    }

    // 3. Create market from proposal
    let market_id = proposal.proposal_id;
    let category_enum = match proposal.category {
        0 => Category::Crypto,
        1 => Category::Sports,
        2 => Category::Politics,
        3 => Category::Tech,
        _ => Category::Other,
    };
    let comparison_enum = match proposal.comparison {
        0 => Comparison::GreaterThan,
        _ => Comparison::LessThan,
    };

    let market = &mut ctx.accounts.market;
    market.market_id = market_id;
    market.authority = ctx.accounts.admin.key();
    market.question = proposal.question.clone();
    market.description = proposal.description.clone();
    market.category = category_enum;
    market.oracle_feed_id = proposal.oracle_feed_id;
    market.target_price = proposal.target_price;
    market.target_expo = proposal.target_expo;
    market.comparison = comparison_enum;
    market.end_ts = proposal.end_ts;
    market.resolve_ts = proposal.resolve_ts;
    market.status = MarketStatus::Open;
    market.winning_outcome = WinningOutcome::Unset;
    market.yes_mint = ctx.accounts.yes_mint.key();
    market.no_mint = ctx.accounts.no_mint.key();
    market.yes_pool_lamports = 0;
    market.no_pool_lamports = 0;
    market.yes_supply = 0;
    market.no_supply = 0;
    market.total_payout_pool = 0;
    market.fee_collected = 0;
    market.fee_withdrawn = false;
    market.total_claimed = 0;
    market.settled_price = 0;
    market.settled_expo = 0;
    market.settled_at = 0;
    market.share_price_lamports = proposal.share_price_lamports;
    market.fee_bps = config.fee_bps;
    market.bump = ctx.bumps.market;
    market.treasury_bump = ctx.bumps.treasury;

    // 4. Set proposal to Approved
    let proposal = &mut ctx.accounts.proposal;
    proposal.status = ProposalStatus::Approved;

    emit!(MarketProposalProcessed {
        proposal_id: market_id,
        proposer: ctx.accounts.proposer.key(),
        status: ProposalStatus::Approved as u8,
        market_id: Some(market_id),
    });

    Ok(())
}