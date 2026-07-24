use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::EmergencyPauseChanged;
use crate::state::{Config, EmergencyPause};

#[derive(Accounts)]
pub struct EmergencyPauseAccounts<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ SolPredictError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init_if_needed,
        payer = admin,
        space = EmergencyPause::LEN,
        seeds = [PAUSE_SEED],
        bump,
    )]
    pub emergency_pause: Account<'info, EmergencyPause>,

    pub system_program: Program<'info, System>,
}

pub fn pause_handler(ctx: Context<EmergencyPauseAccounts>) -> Result<()> {
    let pause = &mut ctx.accounts.emergency_pause;
    require!(!pause.paused, SolPredictError::AlreadyPaused);

    let clock = Clock::get()?;
    pause.paused = true;
    pause.paused_by = ctx.accounts.admin.key();
    pause.paused_at = clock.unix_timestamp;

    if pause.bump == 0 {
        pause.bump = ctx.bumps.emergency_pause;
        pause.required_confirmations = 2;
        pause.guardians = [ctx.accounts.admin.key(); 3];
    }

    emit!(EmergencyPauseChanged {
        paused: true,
        paused_by: ctx.accounts.admin.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

pub fn unpause_handler(ctx: Context<EmergencyPauseAccounts>, confirmations: Vec<Pubkey>) -> Result<()> {
    let pause = &mut ctx.accounts.emergency_pause;
    require!(pause.paused, SolPredictError::NotPaused);

    let mut valid_count = 0u8;
    for guardian in &pause.guardians {
        if guardian == &Pubkey::default() {
            continue;
        }
        if confirmations.contains(guardian) {
            valid_count = valid_count.checked_add(1).ok_or(SolPredictError::MathOverflow)?;
        }
    }

    require!(
        valid_count >= pause.required_confirmations,
        SolPredictError::MultisigRequired
    );

    let clock = Clock::get()?;
    pause.paused = false;
    pause.confirmations = valid_count;

    emit!(EmergencyPauseChanged {
        paused: false,
        paused_by: ctx.accounts.admin.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}