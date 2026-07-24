use anchor_lang::prelude::*;

use crate::constants::*;

#[account]
pub struct MarketProposal {
    pub proposal_id: u64,
    pub proposer: Pubkey,
    pub question: String,
    pub description: String,
    pub category: u8,
    pub oracle_feed_id: [u8; 32],
    pub target_price: i64,
    pub target_expo: i32,
    pub comparison: u8,
    pub end_ts: i64,
    pub resolve_ts: i64,
    pub share_price_lamports: u64,
    pub bond_lamports: u64,
    pub status: ProposalStatus,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
#[repr(u8)]
pub enum ProposalStatus {
    Pending = 0,
    Approved = 1,
    Rejected = 2,
}

impl MarketProposal {
    pub const LEN: usize = 8   // discriminator
        + 8                     // proposal_id
        + 32                    // proposer
        + (4 + MAX_QUESTION_LEN)    // question
        + (4 + MAX_DESCRIPTION_LEN) // description
        + 1                     // category
        + 32                    // oracle_feed_id
        + 8                     // target_price
        + 4                     // target_expo
        + 1                     // comparison
        + 8                     // end_ts
        + 8                     // resolve_ts
        + 8                     // share_price_lamports
        + 8                     // bond_lamports
        + 1                     // status
        + 8                     // created_at
        + 1;                    // bump

    pub const MIN_BOND_LAMPORTS: u64 = 100_000_000; // 0.1 SOL
}