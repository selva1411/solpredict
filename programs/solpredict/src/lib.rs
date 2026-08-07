pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("BXHBts76C2bwRCGuEB2n8nrUeQ5hfHvyHcQSrJQkvzig");

#[program]
pub mod solpredict {
    use super::*;

    /// One-time program bootstrap. Sets admin and fee percentage.
    pub fn initialize_config(ctx: Context<InitializeConfig>, fee_bps: u16) -> Result<()> {
        instructions::initialize_config::handler(ctx, fee_bps)
    }

    /// Transfer platform admin authority to a new wallet (admin-only).
    pub fn update_admin(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
        instructions::update_admin::handler(ctx, new_admin)
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

    /// Update market parameters (admin-only).
    pub fn update_market(
        ctx: Context<UpdateMarket>,
        question: Option<String>,
        description: Option<String>,
        category: Option<u8>,
        end_ts: Option<i64>,
        resolve_ts: Option<i64>,
        share_price_lamports: Option<u64>,
    ) -> Result<()> {
        instructions::update_market::handler(
            ctx,
            question,
            description,
            category,
            end_ts,
            resolve_ts,
            share_price_lamports,
        )
    }

    /// Add liquidity to a market and receive YES/NO tokens + LP position.
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        yes_lamports: u64,
        no_lamports: u64,
    ) -> Result<()> {
        instructions::add_liquidity::handler(ctx, yes_lamports, no_lamports)
    }

    /// Remove liquidity and burn LP tokens, receiving SOL back.
    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        lp_tokens_to_burn: u64,
    ) -> Result<()> {
        instructions::remove_liquidity::handler(ctx, lp_tokens_to_burn)
    }

    /// Emergency withdrawal of funds from a settled or paused market (admin-only).
    pub fn emergency_withdraw(
        ctx: Context<EmergencyWithdrawAccounts>,
    ) -> Result<()> {
        instructions::emergency_withdraw::handler(ctx)
    }

    /// Batch-settle multiple markets in one transaction (admin-only).
    pub fn batch_settle<'info>(
        ctx: Context<'_, '_, 'info, 'info, BatchSettle<'info>>,
        outcomes: Vec<u8>,
    ) -> Result<()> {
        use crate::errors::SolPredictError;
        use crate::events::MarketSettled;
        use crate::state::{Market, MarketStatus, WinningOutcome};
        use crate::utils::payout_math;

        let count = ctx.remaining_accounts.len();
        require!(
            count == outcomes.len() && count <= 10,
            SolPredictError::BatchSizeExceeded
        );

        for i in 0..count {
            let outcome = outcomes[i];
            require!(outcome == 1 || outcome == 2, SolPredictError::InvalidOutcome);

            let mut market = Account::<Market>::try_from(&ctx.remaining_accounts[i])?;

            require!(market.status == MarketStatus::Open, SolPredictError::MarketNotOpen);

            let clock = Clock::get()?;
            require!(clock.unix_timestamp >= market.end_ts, SolPredictError::MarketNotEnded);

            let losing_pool = match outcome {
                1 => market.no_pool_lamports,
                2 => market.yes_pool_lamports,
                _ => 0,
            };

            let fee = payout_math::calculate_fee(losing_pool, ctx.accounts.config.fee_bps)?;
            market.fee_collected = fee;

            let total_pool = market.yes_pool_lamports
                .checked_add(market.no_pool_lamports)
                .ok_or(SolPredictError::MathOverflow)?;
            market.total_payout_pool = total_pool.saturating_sub(fee);

            market.winning_outcome = if outcome == 1 { WinningOutcome::Yes } else { WinningOutcome::No };
            market.status = MarketStatus::Settled;
            market.settled_at = clock.unix_timestamp;

            emit!(MarketSettled {
                market_id: market.market_id,
                winning_outcome: outcome,
                settled_price: market.settled_price,
                total_payout_pool: market.total_payout_pool,
            });
        }

        Ok(())
    }

    /// Emergency-pause the entire program to halt trading (admin-only).
    pub fn emergency_pause(
        ctx: Context<EmergencyPauseAccounts>,
    ) -> Result<()> {
        instructions::emergency_pause::pause_handler(ctx)
    }

    /// Unpause the program (requires guardian confirmations).
    pub fn emergency_unpause(
        ctx: Context<EmergencyPauseAccounts>,
        confirmations: Vec<Pubkey>,
    ) -> Result<()> {
        instructions::emergency_pause::unpause_handler(ctx, confirmations)
    }

    /// Propose a new prediction market (anyone can propose).
    pub fn propose_market(
        ctx: Context<ProposeMarket>,
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
        instructions::propose_market::handler(
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

    /// Approve a pending market proposal and create the market (admin-only).
    pub fn approve_market(ctx: Context<ApproveMarket>) -> Result<()> {
        instructions::approve_market::handler(ctx)
    }
}
