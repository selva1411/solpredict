use anchor_lang::prelude::*;

use crate::errors::SolPredictError;
use crate::state::EmergencyPause;

/// Guard all non-admin trading instructions against an active emergency pause.
///
/// The `EmergencyPause` account is optional because it may never have been
/// initialized (pausing is opt-in). When present AND `paused == true`, the
/// instruction is rejected. When absent, trading proceeds normally.
///
/// Admin-only instructions (settle/cancel/withdraw) intentionally bypass this
/// guard so the protocol can still be wound down while paused.
pub fn check_not_paused(
    emergency_pause: &Option<Account<'_, EmergencyPause>>,
) -> Result<()> {
    if let Some(pause) = emergency_pause {
        require!(!pause.paused, SolPredictError::EmergencyPaused);
    }
    Ok(())
}
