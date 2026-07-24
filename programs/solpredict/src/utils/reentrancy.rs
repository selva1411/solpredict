use anchor_lang::prelude::*;

use crate::errors::SolPredictError;

/// Reentrancy guard stored in accounts.
/// Use explicit acquire/release within a scope block to avoid
/// Rust borrow checker conflicts with mutable account access.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug)]
pub struct ReentrancyLock {
    pub locked: u8,
    pub locker: Pubkey,
}

impl ReentrancyLock {
    pub const fn default() -> Self {
        Self {
            locked: 0,
            locker: Pubkey::new_from_array([0u8; 32]),
        }
    }

    pub fn acquire(&mut self, current_program: &Pubkey) -> Result<()> {
        require!(self.locked == 0, SolPredictError::ReentrancyDetected);
        self.locked = 1;
        self.locker = *current_program;
        Ok(())
    }

    pub fn release(&mut self) {
        self.locked = 0;
        self.locker = Pubkey::new_from_array([0u8; 32]);
    }
}