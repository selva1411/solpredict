use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::MarketProposalProcessed;
use crate::state::{Config, MarketProposal, ProposalStatus};

/// Accounts for the `reject_market` instruction.
///
/// Closes a pending market proposal on-chain and slashes its escrowed bond.
/// Only the platform admin can reject a proposal. Unlike `approve_market`,
/// no Market / mints / treasury are created — the proposal PDA is closed
/// (rent reclaimed) and the bond held in the proposal vault is forfeited to
/// the admin (the protocol operator), not returned to the proposer.
#[derive(Accounts)]
pub struct RejectMarket<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ SolPredictError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    /// MarketProposal PDA — closed and rent sent back to the admin.
    #[account(
        mut,
        close = admin,
        seeds = [PROPOSAL_SEED, proposal.proposal_id.to_le_bytes().as_ref()],
        bump = proposal.bump,
        constraint = proposal.status == ProposalStatus::Pending @ SolPredictError::ProposalNotPending,
    )]
    pub proposal: Account<'info, MarketProposal>,

    /// CHECK: vault holding the proposal bond — slashed (transferred to admin).
    #[account(
        mut,
        seeds = [PROPOSAL_VAULT_SEED, proposal.proposal_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub proposal_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RejectMarket>) -> Result<()> {
    let proposal = &ctx.accounts.proposal;
    let vault_lamports = ctx.accounts.proposal_vault.lamports();

    // Slash the bond: forfeit everything in the proposal vault to the admin.
    // The full vault balance (the 0.1 SOL bond; the vault holds no rent since
    // it is a zero-data System account funded by the proposer) is transferred.
    if vault_lamports > 0 {
        let proposal_id_bytes = proposal.proposal_id.to_le_bytes();
        let vault_bump = ctx.bumps.proposal_vault;
        let seeds = &[PROPOSAL_VAULT_SEED, proposal_id_bytes.as_slice(), &[vault_bump]];
        let signer_seeds = &[&seeds[..]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.proposal_vault.to_account_info(),
                    to: ctx.accounts.admin.to_account_info(),
                },
                signer_seeds,
            ),
            vault_lamports,
        )?;
    }

    emit!(MarketProposalProcessed {
        proposal_id: proposal.proposal_id,
        proposer: proposal.proposer,
        status: ProposalStatus::Rejected as u8,
        market_id: None,
    });

    msg!(
        "Proposal {} rejected by admin {}. Bond slashed: {} lamports forfeited to admin.",
        proposal.proposal_id,
        ctx.accounts.admin.key(),
        vault_lamports
    );

    Ok(())
}
