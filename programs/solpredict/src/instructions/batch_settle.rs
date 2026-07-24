use anchor_lang::prelude::*;

use crate::state::Config;

/// Batch-settle uses remaining_accounts for markets.
/// Markets are passed as extra accounts after struct accounts.
#[derive(Accounts)]
pub struct BatchSettle<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
        constraint = admin.key() == config.admin @ crate::errors::SolPredictError::Unauthorized,
    )]
    pub config: Account<'info, Config>,
}