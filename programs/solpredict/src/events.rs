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

/// Emitted when a market is settled via `settle_market`.
#[event]
pub struct MarketSettled {
    pub market_id: u64,
    pub winning_outcome: u8,
    pub settled_price: i64,
    pub total_payout_pool: u64,
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
