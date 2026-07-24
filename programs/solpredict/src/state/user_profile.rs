// TODO Phase 6 — On-chain user profile
use anchor_lang::prelude::*;

#[account]
pub struct UserProfile {
    pub wallet: Pubkey,
    pub username: String,
    pub bio: String,
    pub avatar_url: String,
    pub twitter_handle: String,
    pub followers_count: u64,
    pub following_count: u64,
    pub bump: u8,
}

impl UserProfile {
    pub const LEN: usize = 8 + 32 + (4 + 50) + (4 + 200) + (4 + 200) + (4 + 50) + 8 + 8 + 1;
}