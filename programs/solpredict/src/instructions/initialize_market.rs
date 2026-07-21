use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::MarketCreated;
use crate::state::{Category, Comparison, Config, Market, MarketStatus, WinningOutcome};

/// Accounts for the `initialize_market` instruction.
///
/// Only the admin (stored in Config) can create markets.
/// Creates the Market PDA, YES mint, NO mint, and derives the Treasury PDA.
#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    /// Admin signer — must match `config.admin`.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Config PDA — read admin + increment market_count.
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ SolPredictError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    /// Market PDA — created for this market.
    /// Seeds: ["market", market_id.to_le_bytes()]
    /// market_id = config.market_count (before increment)
    #[account(
        init,
        payer = admin,
        space = Market::LEN,
        seeds = [MARKET_SEED, config.market_count.to_le_bytes().as_ref()],
        bump,
    )]
    pub market: Account<'info, Market>,

    /// YES token mint — mint authority = Market PDA (trustless minting).
    /// Seeds: ["yes_mint", market.key()]
    #[account(
        init,
        payer = admin,
        mint::decimals = SHARE_DECIMALS,
        mint::authority = market,
        seeds = [YES_MINT_SEED, market.key().as_ref()],
        bump,
    )]
    pub yes_mint: Account<'info, Mint>,

    /// NO token mint — mint authority = Market PDA (trustless minting).
    /// Seeds: ["no_mint", market.key()]
    #[account(
        init,
        payer = admin,
        mint::decimals = SHARE_DECIMALS,
        mint::authority = market,
        seeds = [NO_MINT_SEED, market.key().as_ref()],
        bump,
    )]
    pub no_mint: Account<'info, Mint>,

    /// Treasury PDA — holds market's SOL pool.
    /// Seeds: ["treasury", market.key()]
    /// SystemAccount: no data, just holds lamports.
    /// CHECK: This is a PDA used as a SOL vault. It's validated by seeds constraint.
    #[account(
        seeds = [TREASURY_SEED, market.key().as_ref()],
        bump,
    )]
    pub treasury: SystemAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// Handler for `initialize_market`.
///
/// Validates all inputs, creates the market with its mints and treasury,
/// and emits a MarketCreated event for frontend subscriptions.
pub fn handler(
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
    let clock = Clock::get()?;

    // ---- Input Validation ----

    // 1. End time must be in the future
    require!(end_ts > clock.unix_timestamp, SolPredictError::InvalidEndTime);

    // 2. Resolve time must be >= end time
    require!(resolve_ts >= end_ts, SolPredictError::InvalidEndTime);

    // 3. Question length validation
    require!(
        !question.is_empty() && question.len() <= MAX_QUESTION_LEN,
        SolPredictError::QuestionTooLong
    );

    // 4. Description length validation
    require!(
        description.len() <= MAX_DESCRIPTION_LEN,
        SolPredictError::DescriptionTooLong
    );

    // 5. Share price minimum (0.001 SOL = 1_000_000 lamports)
    require!(
        share_price_lamports >= MIN_SHARE_PRICE,
        SolPredictError::SharePriceTooLow
    );

    // 6. Validate category enum value
    let category_enum = match category {
        0 => Category::Crypto,
        1 => Category::Sports,
        2 => Category::Politics,
        3 => Category::Tech,
        _ => Category::Other,
    };

    // Enforce that Sports and Politics categories cannot be initialized with a price feed
    if category_enum == Category::Sports || category_enum == Category::Politics {
        require!(
            oracle_feed_id == [0u8; 32],
            SolPredictError::UseManualSettlement
        );
    }

    // 7. Validate comparison enum value
    let comparison_enum = match comparison {
        0 => Comparison::GreaterThan,
        _ => Comparison::LessThan,
    };

    // ---- State Updates ----

    // 8. Assign market_id and increment config counter
    let config = &mut ctx.accounts.config;
    let market_id = config.market_count;
    config.market_count = config
        .market_count
        .checked_add(1)
        .ok_or(SolPredictError::MathOverflow)?;

    // 9. Populate all Market fields
    let market = &mut ctx.accounts.market;
    market.market_id = market_id;
    market.authority = ctx.accounts.admin.key();
    market.question = question.clone();
    market.description = description;
    market.category = category_enum;
    market.oracle_feed_id = oracle_feed_id;
    market.target_price = target_price;
    market.target_expo = target_expo;
    market.comparison = comparison_enum;
    market.end_ts = end_ts;
    market.resolve_ts = resolve_ts;
    market.status = MarketStatus::Open;
    market.winning_outcome = WinningOutcome::Unset;
    market.yes_mint = ctx.accounts.yes_mint.key();
    market.no_mint = ctx.accounts.no_mint.key();
    market.yes_pool_lamports = 0;
    market.no_pool_lamports = 0;
    market.yes_supply = 0;
    market.no_supply = 0;
    market.total_payout_pool = 0;
    market.fee_collected = 0;
    market.fee_withdrawn = false;
    market.total_claimed = 0;
    market.settled_price = 0;
    market.settled_expo = 0;
    market.settled_at = 0;
    market.share_price_lamports = share_price_lamports;
    market.bump = ctx.bumps.market;
    market.treasury_bump = ctx.bumps.treasury;

    // 10. Emit event for frontend
    emit!(MarketCreated {
        market_id,
        question,
        end_ts,
    });

    msg!(
        "Market {} created: end_ts={}, resolve_ts={}, share_price={}",
        market_id,
        end_ts,
        resolve_ts,
        share_price_lamports
    );

    Ok(())
}
