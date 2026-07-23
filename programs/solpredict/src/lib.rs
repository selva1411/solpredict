pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("B7iciCdfA2Jw3yrQVrYtZMMdbehaqr2XS8kF89ageCWU");

#[program]
pub mod solpredict {
    use super::*;

    /// One-time program bootstrap. Sets admin and fee percentage.
    pub fn initialize_config(ctx: Context<InitializeConfig>, fee_bps: u16) -> Result<()> {
        instructions::initialize_config::handler(ctx, fee_bps)
    }

    /// Create a new prediction market (admin-only).
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        question: String,
        description: String,
        category: u8,
        oracle_feed_id: [u8; 32],
        target_price: i64,
        target_expo: i32,
        comparison: u8,
        end_ts: i64,
        resolve_ts: i64,
        share_price_lamports: u64,
    ) -> Result<()> {
        instructions::initialize_market::handler(
            ctx,
            question,
            description,
            category,
            oracle_feed_id,
            target_price,
            target_expo,
            comparison,
            end_ts,
            resolve_ts,
            share_price_lamports,
        )
    }

    /// Buy YES or NO shares on a market.
    pub fn buy_shares(ctx: Context<BuyShares>, side: Side, quantity: u64) -> Result<()> {
        instructions::buy_shares::handler(ctx, side, quantity)
    }

    /// Sell YES or NO shares back to the pool before market expiry.
    pub fn sell_shares(ctx: Context<SellShares>, side: Side, quantity: u64) -> Result<()> {
        instructions::sell_shares::handler(ctx, side, quantity)
    }

    /// Settle a market using a Pyth oracle price (admin-only).
    pub fn settle_market(ctx: Context<SettleMarket>) -> Result<()> {
        instructions::settle_market::handler(ctx)
    }

    /// Settle a market manually (admin-only).
    pub fn settle_market_manual(ctx: Context<SettleMarketManual>, outcome: u8) -> Result<()> {
        instructions::settle_market_manual::handler(ctx, outcome)
    }

    /// Claim pro-rata SOL rewards on a settled market (winners only).
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        instructions::claim_rewards::handler(ctx)
    }

    /// Cancel an open market (admin-only).
    pub fn cancel_market(ctx: Context<CancelMarket>, reason: String) -> Result<()> {
        instructions::cancel_market::handler(ctx, reason)
    }

    /// Claim a full refund on a cancelled market.
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        instructions::claim_refund::handler(ctx)
    }

    /// Withdraw collected protocol fees from a settled market (admin-only).
    pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()> {
        instructions::withdraw_fees::handler(ctx)
    }

    /// Close UserPosition PDA after market resolution and reclaim ~0.0015 SOL rent deposit.
    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        instructions::close_position::handler(ctx)
    }

    /// Place an on-chain limit order (Bid or Ask) for a prediction outcome.
    pub fn place_order(
        ctx: Context<PlaceOrder>,
        order_id: u64,
        side: Side,
        is_buy: bool,
        price_bps: u64,
        quantity: u64,
    ) -> Result<()> {
        instructions::place_order::handler(ctx, order_id, side, is_buy, price_bps, quantity)
    }

    /// Cancel an open limit order and reclaim escrowed SOL or tokens.
    pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
        instructions::cancel_order::handler(ctx)
    }

    /// Match/fill an open limit order (P2P trade).
    pub fn fill_order(ctx: Context<FillOrder>, quantity: u64) -> Result<()> {
        instructions::fill_order::handler(ctx, quantity)
    }

    /// Create mock Pyth PriceUpdateV2 account data (devnet-only, never ship to mainnet).
    #[cfg(feature = "devnet-mock")]
    pub fn mock_create_price_update(
        ctx: Context<MockCreatePriceUpdate>,
        feed_id: [u8; 32],
        price: i64,
        conf: u64,
        exponent: i32,
        publish_time: i64,
    ) -> Result<()> {
        instructions::mock_create_price_update::handler(
            ctx,
            feed_id,
            price,
            conf,
            exponent,
            publish_time,
        )
    }
}
