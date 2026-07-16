use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::MarketSettled;
use crate::state::{Category, Config, Market, MarketStatus, WinningOutcome};
use crate::utils::{oracle, payout_math};

/// Accounts for the `settle_market` instruction.
///
/// Admin-only. Reads a Pyth PriceUpdateV2 account (posted on-chain in the
/// same transaction bundle) to determine the market outcome.
///
/// NOTE: We use UncheckedAccount for the Pyth price update to avoid an
/// anchor-lang version conflict (pyth SDK 2.0.0 uses anchor 1.x internally).
/// The oracle::validate_and_read_price function handles all validation
/// including account data parsing, staleness, feed ID, and confidence checks.
#[derive(Accounts)]
pub struct SettleMarket<'info> {
    /// Admin signer — must match `config.admin`.
    pub admin: Signer<'info>,

    /// Config PDA — to verify admin identity.
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ SolPredictError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    /// Market PDA — must be Open, not already settled.
    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// Pyth PriceUpdateV2 account — posted just before this instruction
    /// in the same transaction bundle.
    /// CHECK: Validated inside oracle::validate_and_read_price which parses
    /// the account data, verifies feed ID, staleness, and confidence.
    pub price_update: UncheckedAccount<'info>,
}

/// Handler for `settle_market`.
///
/// Reads the oracle price, validates it, determines the winner, computes
/// fees and payout pool, and transitions the market to Settled (or Cancelled
/// if one-sided).
pub fn handler(ctx: Context<SettleMarket>) -> Result<()> {
    let market = &ctx.accounts.market;
    let clock = Clock::get()?;

    // Only Crypto, Tech, and Other markets can be settled via oracle
    require!(
        market.category == Category::Crypto || market.category == Category::Tech || market.category == Category::Other,
        SolPredictError::UseManualSettlement
    );

    // 1. Market must be Open (blocks double-settlement)
    require!(
        market.status == MarketStatus::Open,
        SolPredictError::AlreadySettled
    );

    // 2. Must be past resolve_ts
    require!(
        clock.unix_timestamp >= market.resolve_ts,
        SolPredictError::TooEarlyToSettle
    );

    // 3. Read and validate oracle price
    //    This enforces: staleness ≤ 60s, feed id match, confidence ≤ 2%
    let validated_price = oracle::validate_and_read_price(
        &ctx.accounts.price_update.to_account_info(),
        &clock,
        &market.oracle_feed_id,
        MAX_STALENESS_SECS,
    )?;

    // 4. Compare oracle price against target to determine winner
    let yes_wins = oracle::compare_prices(
        validated_price.price,
        validated_price.expo,
        market.target_price,
        market.target_expo,
        market.comparison,
    )?;

    let winning_outcome = if yes_wins {
        WinningOutcome::Yes
    } else {
        WinningOutcome::No
    };

    // 5. One-sided market check: if winning side has zero supply,
    //    auto-cancel instead of stranding the losing side's funds.
    let winning_supply = match winning_outcome {
        WinningOutcome::Yes => market.yes_supply,
        WinningOutcome::No => market.no_supply,
        WinningOutcome::Unset => 0, // unreachable
    };

    let market = &mut ctx.accounts.market;

    if winning_supply == 0 {
        // Nobody bet on the winning side → cancel, let everyone refund
        market.status = MarketStatus::Cancelled;
        market.settled_price = validated_price.price;
        market.settled_expo = validated_price.expo;
        market.settled_at = clock.unix_timestamp;

        msg!(
            "Market {} auto-cancelled: winning side has zero supply",
            market.market_id
        );

        emit!(MarketSettled {
            market_id: market.market_id,
            winning_outcome: winning_outcome as u8,
            settled_price: validated_price.price,
            total_payout_pool: 0,
        });

        return Ok(());
    }

    // 6. Compute fee and payout pool
    let yes_pool = market.yes_pool_lamports;
    let no_pool = market.no_pool_lamports;

    let total_pool = yes_pool
        .checked_add(no_pool)
        .ok_or(SolPredictError::MathOverflow)?;

    let losing_pool = match winning_outcome {
        WinningOutcome::Yes => no_pool,
        WinningOutcome::No => yes_pool,
        WinningOutcome::Unset => 0,
    };

    let fee = payout_math::calculate_fee(losing_pool, ctx.accounts.config.fee_bps)?;

    let total_payout_pool = total_pool
        .checked_sub(fee)
        .ok_or(SolPredictError::MathOverflow)?;

    // 7. Store settlement results
    market.status = MarketStatus::Settled;
    market.winning_outcome = winning_outcome;
    market.settled_price = validated_price.price;
    market.settled_expo = validated_price.expo;
    market.settled_at = clock.unix_timestamp;
    market.fee_collected = fee;
    market.total_payout_pool = total_payout_pool;

    // 8. Emit event
    emit!(MarketSettled {
        market_id: market.market_id,
        winning_outcome: winning_outcome as u8,
        settled_price: validated_price.price,
        total_payout_pool,
    });

    msg!(
        "Market {} settled: winner={:?}, price={}, payout_pool={}, fee={}",
        market.market_id,
        winning_outcome,
        validated_price.price,
        total_payout_pool,
        fee
    );

    Ok(())
}
