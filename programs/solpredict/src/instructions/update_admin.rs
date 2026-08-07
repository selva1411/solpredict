use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::state::Config;

/// Accounts for the `update_admin` instruction.
///
/// Transfers platform admin authority from the current `config.admin` to a
/// new wallet. Only the current admin can call this. All existing markets,
/// mints, and treasury balances are preserved.
#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    /// Current admin signer — must match `config.admin`.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Config PDA — its `admin` field is overwritten.
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ SolPredictError::Unauthorized,
    )]
    pub config: Account<'info, Config>,
}

/// Handler for `update_admin`.
///
/// Replaces `config.admin` with the supplied pubkey. The new admin can be any
/// Solana account (e.g. a browser wallet). The transfer is immediate and
/// irreversible by the old admin.
pub fn handler(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let old_admin = config.admin;
    config.admin = new_admin;

    msg!(
        "Admin updated: {} -> {}",
        old_admin,
        config.admin
    );

    Ok(())
}
