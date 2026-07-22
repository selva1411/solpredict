use anchor_lang::prelude::*;
use crate::state::Side;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
#[repr(u8)]
pub enum OrderStatus {
    Open = 0,
    Filled = 1,
    Cancelled = 2,
}

/// Order PDA — represents an on-chain limit order (Bid or Ask) for a market.
/// Seeds: ["order", market.key(), maker.key(), order_id.to_le_bytes()]
#[account]
pub struct Order {
    /// Market account this order belongs to.
    pub market: Pubkey,

    /// Order maker address.
    pub maker: Pubkey,

    /// Unique order ID per user.
    pub order_id: u64,

    /// Outcome side: YES or NO.
    pub side: Side,

    /// Order side: true = Buy (Bid), false = Sell (Ask).
    pub is_buy: bool,

    /// Limit price in basis points (1 to 9999 representing 0.0001 to 0.9999 SOL per share).
    pub price_bps: u64,

    /// Total quantity of shares in base units (shares * 10^6).
    pub quantity: u64,

    /// Quantity already filled.
    pub filled_quantity: u64,

    /// Current order status.
    pub status: OrderStatus,

    /// Order PDA canonical bump.
    pub bump: u8,
}

impl Order {
    pub const LEN: usize = 8 // discriminator
        + 32 // market
        + 32 // maker
        + 8  // order_id
        + 1  // side
        + 1  // is_buy
        + 8  // price_bps
        + 8  // quantity
        + 8  // filled_quantity
        + 1  // status
        + 1; // bump
}
