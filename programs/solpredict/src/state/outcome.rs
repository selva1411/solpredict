// TODO Phase 3 — Multi-outcome support
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, Debug)]
pub struct Outcome {
    pub label: [u8; 32],
    pub mint: Pubkey,
    pub pool_lamports: u64,
    pub supply: u64,
    pub bump: u8,
}

impl Outcome {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}