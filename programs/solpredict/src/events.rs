use anchor_lang::prelude::*;

use crate::state::Side;

/// Emitted when a new market is created via `initialize_market`.
/// Frontend subscribes for live "new market" toasts and grid updates.
#[event]
pub struct MarketCreated {
    pub market_id: u64,
    pub question: String,
    pub end_ts: i64,
}

/// Emitted when shares are purchased via `buy_shares`.
/// Powers the live activity feed and real-time probability bar updates.
#[event]
pub struct SharesPurchased {
    pub market_id: u64,
    pub buyer: Pubkey,
    pub side: Side,
    pub quantity: u64,
    pub cost: u64,
    pub new_yes_pool: u64,
    pub new_no_pool: u64,
}

/// Emitted when a market is settled via `settle_market` (Pyth oracle).
#[event]
pub struct MarketSettled {
    pub market_id: u64,
    pub winning_outcome: u8,
    pub settled_price: i64,
    pub total_payout_pool: u64,
}

/// Emitted when a market is settled manually (non-crypto markets).
#[event]
pub struct MarketSettledManual {
    pub market_id: u64,
    pub winning_outcome: u8,
    pub fee_collected: u64,
    pub total_payout_pool: u64,
    pub settled_by: Pubkey,
    pub settled_at: i64,
}

/// Emitted when a winner claims their rewards via `claim_rewards`.
#[event]
pub struct RewardsClaimed {
    pub market_id: u64,
    pub claimer: Pubkey,
    pub payout: u64,
}

/// Emitted when a market is cancelled via `cancel_market`.
#[event]
pub struct MarketCancelled {
    pub market_id: u64,
    pub cancelled_by: Pubkey,
    pub reason: String,
}

/// Emitted when a user claims a refund on a cancelled market.
#[event]
pub struct RefundClaimed {
    pub market_id: u64,
    pub user: Pubkey,
    pub refund: u64,
}

/// Emitted when the admin withdraws collected fees.
#[event]
pub struct FeesWithdrawn {
    pub market_id: u64,
    pub amount: u64,
}

/// Emitted when a user sells shares back to the pool before expiry.
#[event]
pub struct SharesSold {
    pub market_id: u64,
    pub seller: Pubkey,
    pub side: Side,
    pub quantity: u64,
    pub refund: u64,
}

/// Emitted when a user closes their position account to reclaim rent.
#[event]
pub struct PositionClosed {
    pub market_id: u64,
    pub user: Pubkey,
    pub rent_reclaimed: u64,
}

/// Emitted when market details are updated via `update_market`.
#[event]
pub struct MarketUpdated {
    pub market_id: u64,
    pub question: String,
    pub end_ts: i64,
}

/// Emitted when liquidity is added via `add_liquidity`.
#[event]
pub struct LiquidityAdded {
    pub market_id: u64,
    pub provider: Pubkey,
    pub yes_lamports: u64,
    pub no_lamports: u64,
    pub lp_tokens_minted: u64,
}

/// Emitted when liquidity is removed via `remove_liquidity`.
#[event]
pub struct LiquidityRemoved {
    pub market_id: u64,
    pub provider: Pubkey,
    pub yes_payout: u64,
    pub no_payout: u64,
    pub lp_tokens_burned: u64,
}

/// Emitted when admin performs emergency withdrawal.
#[event]
pub struct EmergencyWithdraw {
    pub market_id: u64,
    pub admin: Pubkey,
    pub amount: u64,
    pub reason: String,
}

/// Emitted when program is paused or unpaused.
#[event]
pub struct EmergencyPauseChanged {
    pub paused: bool,
    pub paused_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when a user proposes a new market.
#[event]
pub struct MarketProposed {
    pub proposal_id: u64,
    pub proposer: Pubkey,
    pub question: String,
    pub bond_lamports: u64,
    pub created_at: i64,
}

/// Emitted when a market proposal is approved (or rejected) by the admin.
#[event]
pub struct MarketProposalProcessed {
    pub proposal_id: u64,
    pub proposer: Pubkey,
    pub status: u8,
    pub market_id: Option<u64>,
}
