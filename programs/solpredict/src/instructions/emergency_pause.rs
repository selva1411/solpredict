use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::EmergencyPauseChanged;
use crate::state::{Config, EmergencyPause};

/// Maximum number of distinct guardians that can be registered. The on-chain
/// `EmergencyPause.guardians` array is fixed at this size.
pub const MAX_GUARDIANS: usize = 3;

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

/// Seed a freshly-created emergency_pause account. The admin is registered as
/// the first guardian; the remaining slots are empty (`Pubkey::default()`)
/// until `add_guardian` fills them. The default threshold is 1 — a single
/// verified guardian signature — and can be raised with
/// `set_guardian_threshold` once distinct guardians exist.
///
/// NOTE: the account is created via `init_if_needed`, so this runs the first
/// time ANY pause/guardian instruction touches it (Anchor zero-fills the
/// account data, so `bump == 0` is the uninitialized marker).
fn seed_guardians(pause: &mut Account<EmergencyPause>, admin: Pubkey, bump: u8) {
    pause.bump = bump;
    pause.required_confirmations = 1;
    pause.guardians = [Pubkey::default(); MAX_GUARDIANS];
    pause.guardians[0] = admin;
}

pub fn pause_handler(ctx: Context<EmergencyPauseAccounts>) -> Result<()> {
    let pause = &mut ctx.accounts.emergency_pause;
    if pause.bump == 0 {
        seed_guardians(pause, ctx.accounts.admin.key(), ctx.bumps.emergency_pause);
    }
    require!(!pause.paused, SolPredictError::AlreadyPaused);

    let clock = Clock::get()?;
    pause.paused = true;
    pause.paused_by = ctx.accounts.admin.key();
    pause.paused_at = clock.unix_timestamp;

    emit!(EmergencyPauseChanged {
        paused: true,
        paused_by: ctx.accounts.admin.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

pub fn unpause_handler(ctx: Context<EmergencyPauseAccounts>) -> Result<()> {
    let pause = &ctx.accounts.emergency_pause;
    require!(pause.paused, SolPredictError::NotPaused);

    // Real multisig: the guardians must actually SIGN this transaction. They
    // are passed as extra signer accounts via remaining_accounts and verified
    // on-chain. Previously the confirmations were a client-supplied list of
    // pubkeys with no signature check — anyone could claim any guardian.
    let mut valid_count = 0u8;
    for info in ctx.remaining_accounts.iter() {
        if !info.is_signer {
            continue;
        }
        if pause.guardians.contains(info.key) {
            valid_count = valid_count.checked_add(1).ok_or(SolPredictError::MathOverflow)?;
        }
    }

    require!(
        valid_count >= pause.required_confirmations,
        SolPredictError::MultisigRequired
    );

    let clock = Clock::get()?;
    let pause = &mut ctx.accounts.emergency_pause;
    pause.paused = false;
    pause.confirmations = valid_count;

    emit!(EmergencyPauseChanged {
        paused: false,
        paused_by: ctx.accounts.admin.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Register a new distinct guardian. Admin-only (via `config.admin`
/// constraint on the accounts struct). The guardian set is a fixed array of
/// `MAX_GUARDIANS` (3) slots; empty slots are `Pubkey::default()`. This can be
/// called before the first pause to pre-configure the multisig.
pub fn add_guardian_handler(
    ctx: Context<EmergencyPauseAccounts>,
    new_guardian: Pubkey,
) -> Result<()> {
    require!(
        new_guardian != Pubkey::default(),
        SolPredictError::InvalidGuardian
    );

    let pause = &mut ctx.accounts.emergency_pause;
    if pause.bump == 0 {
        seed_guardians(pause, ctx.accounts.admin.key(), ctx.bumps.emergency_pause);
    }

    require!(
        !pause.guardians.contains(&new_guardian),
        SolPredictError::GuardianAlreadyExists
    );

    let slot = pause
        .guardians
        .iter()
        .position(|g| *g == Pubkey::default())
        .ok_or(SolPredictError::MaxGuardiansReached)?;
    pause.guardians[slot] = new_guardian;

    Ok(())
}

/// Remove a guardian. Admin-only. The removal is rejected if it would leave
/// fewer guardians than the configured threshold (the multisig would become
/// impossible to satisfy) — lower the threshold first in that case.
pub fn remove_guardian_handler(
    ctx: Context<EmergencyPauseAccounts>,
    guardian: Pubkey,
) -> Result<()> {
    let pause = &mut ctx.accounts.emergency_pause;

    let slot = pause
        .guardians
        .iter()
        .position(|g| *g == guardian)
        .ok_or(SolPredictError::GuardianNotFound)?;

    // Active = non-empty slots. Simulate the removal: the guardian leaving is
    // no longer active, so the remaining count is active - 1.
    let active = pause
        .guardians
        .iter()
        .filter(|g| **g != Pubkey::default())
        .count() as u8;
    require!(
        active.checked_sub(1).unwrap_or(0) >= pause.required_confirmations,
        SolPredictError::ThresholdExceedsGuardians
    );

    pause.guardians[slot] = Pubkey::default();

    Ok(())
}

/// Set how many distinct guardian signatures are required to unpause. Must be
/// at least 1 and at most the number of currently-registered guardians.
pub fn set_guardian_threshold_handler(
    ctx: Context<EmergencyPauseAccounts>,
    new_threshold: u8,
) -> Result<()> {
    let pause = &mut ctx.accounts.emergency_pause;
    if pause.bump == 0 {
        seed_guardians(pause, ctx.accounts.admin.key(), ctx.bumps.emergency_pause);
    }

    require!(new_threshold >= 1, SolPredictError::InvalidThreshold);

    let active = pause
        .guardians
        .iter()
        .filter(|g| **g != Pubkey::default())
        .count() as u8;
    require!(
        new_threshold <= active,
        SolPredictError::ThresholdExceedsGuardians
    );

    pause.required_confirmations = new_threshold;

    Ok(())
}
