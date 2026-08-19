use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::errors::SolPredictError;

pub mod oracle;
pub mod payout_math;
pub mod reentrancy;
pub mod amm_math;
pub mod pause_guard;

pub use oracle::*;
pub use payout_math::*;
pub use reentrancy::ReentrancyLock;
pub use amm_math::*;
pub use pause_guard::check_not_paused;

/// Verifies a caller-supplied token account is an ATA of the expected mint and
/// is owned by the expected party. Deserializes as an SPL `TokenAccount` (the
/// ATA is always a plain token account) and compares mint + owner against what
/// the order's side demands. Prevents substituting an unrelated mint's ATA or
/// someone else's tokens when unwinding an order's escrow.
pub fn require_valid_ata<'info>(
    ata: &AccountInfo<'info>,
    expected_mint: Pubkey,
    expected_owner: Pubkey,
) -> Result<()> {
    let data = ata.try_borrow_data().map_err(|_| SolPredictError::InvalidMint)?;
    let token_account = TokenAccount::try_deserialize(&mut &data[..])
        .map_err(|_| SolPredictError::InvalidMint)?;
    require!(token_account.mint == expected_mint, SolPredictError::InvalidMint);
    require!(token_account.owner == expected_owner, SolPredictError::Unauthorized);
    Ok(())
}
