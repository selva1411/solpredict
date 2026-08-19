use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::SharesPurchased;
use crate::state::{EmergencyPause, Market, MarketStatus, Side, UserPosition};
use crate::utils::{amm_math, check_not_paused, payout_math};

/// Accounts for the `buy_shares` instruction.
///
/// One instruction with a `Side { Yes, No }` enum — cleaner than duplicating
/// buy_yes/buy_no on-chain. Client exposes `buyYes()`/`buyNo()` wrappers.
#[derive(Accounts)]
pub struct BuyShares<'info> {
    /// Buyer — signs and pays SOL.
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// Market PDA — must be Open and not expired.
    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// Treasury PDA — receives SOL payment.
    /// CHECK: Validated by seeds constraint. Holds raw lamports only.
    #[account(
        mut,
        seeds = [TREASURY_SEED, market.key().as_ref()],
        bump = market.treasury_bump,
    )]
    pub treasury: SystemAccount<'info>,

    /// YES token mint — may or may not be the one we mint to (depends on side).
    #[account(
        mut,
        seeds = [YES_MINT_SEED, market.key().as_ref()],
        bump,
        constraint = yes_mint.key() == market.yes_mint @ SolPredictError::InvalidMint,
    )]
    pub yes_mint: Account<'info, Mint>,

    /// NO token mint.
    #[account(
        mut,
        seeds = [NO_MINT_SEED, market.key().as_ref()],
        bump,
        constraint = no_mint.key() == market.no_mint @ SolPredictError::InvalidMint,
    )]
    pub no_mint: Account<'info, Mint>,

    /// Buyer's ATA for the chosen mint — init_if_needed since this may be
    /// the buyer's first purchase of this token.
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = yes_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_yes_ata: Account<'info, TokenAccount>,

    /// Buyer's ATA for NO mint.
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = no_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_no_ata: Account<'info, TokenAccount>,

    /// UserPosition PDA — init_if_needed for first-time buyers.
    /// Seeds: ["position", market, buyer]
    #[account(
        init_if_needed,
        payer = buyer,
        space = UserPosition::LEN,
        seeds = [POSITION_SEED, market.key().as_ref(), buyer.key().as_ref()],
        bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    /// Optional emergency-pause account. When present and paused, trading is
    /// halted. Absent when the program has never been paused.
    pub emergency_pause: Option<Account<'info, EmergencyPause>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Handler for `buy_shares`.
///
/// Validates market state, transfers SOL to treasury, mints YES or NO tokens
/// to buyer's ATA, and updates pool/supply/position accounting.
pub fn handler(
    ctx: Context<BuyShares>,
    side: Side,
    quantity: u64,
    max_cost_lamports: u64,
) -> Result<()> {
    check_not_paused(&ctx.accounts.emergency_pause)?;

    let market = &ctx.accounts.market;

    require!(
        market.status == MarketStatus::Open,
        SolPredictError::MarketNotOpen
    );

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < market.end_ts,
        SolPredictError::MarketExpired
    );

    require!(
        quantity > 0 && quantity <= MAX_SHARES_PER_TX,
        SolPredictError::InvalidQuantity
    );

    let pool_yes = market.yes_pool_lamports as u128;
    let pool_no = market.no_pool_lamports as u128;
    let dy_out = (quantity as u128) * (market.share_price_lamports as u128);
    let fee_bps = market.fee_bps;

    // Probability-based CPMM (amm_math). Empty-side pools keep the documented
    // Flat Linear Minting (baseline cost = quantity × share_price) — the curve
    // takes over once BOTH sides carry value.
    let cost_u128 = if dy_out == 0 || pool_yes == 0 || pool_no == 0 {
        payout_math::calculate_cost(quantity, market.share_price_lamports)? as u128
    } else {
        match side {
            Side::Yes => amm_math::get_buy_cost_in(pool_yes, pool_no, dy_out, fee_bps),
            Side::No => amm_math::get_buy_cost_in(pool_no, pool_yes, dy_out, fee_bps),
        }.map_err(|_| error!(SolPredictError::MathOverflow))?
    };
    let cost = u64::try_from(cost_u128).map_err(|_| error!(SolPredictError::MathOverflow))?;

    // Slippage protection: reject the trade if the actual cost exceeds the
    // buyer's stated maximum, preventing front-running between simulation and
    // execution.
    require!(cost <= max_cost_lamports, SolPredictError::SlippageExceeded);

    // Hold the market's reentrancy lock BEFORE any funds move. Previously the
    // lock was acquired after the transfer to treasury.
    ctx.accounts.market.reentrancy_lock.acquire(&crate::ID)?;

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        cost,
    )?;

    let mint_amount = (quantity as u128)
        .checked_mul(BASE_UNITS_PER_SHARE as u128)
        .ok_or(SolPredictError::MathOverflow)?;
    let mint_amount_u64 =
        u64::try_from(mint_amount).map_err(|_| SolPredictError::MathOverflow)?;

    let (mint_account, ata_account) = match side {
        Side::Yes => (
            ctx.accounts.yes_mint.to_account_info(),
            ctx.accounts.buyer_yes_ata.to_account_info(),
        ),
        Side::No => (
            ctx.accounts.no_mint.to_account_info(),
            ctx.accounts.buyer_no_ata.to_account_info(),
        ),
    };

    let market_id_bytes = ctx.accounts.market.market_id.to_le_bytes();
    let market_bump = ctx.accounts.market.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        MARKET_SEED,
        market_id_bytes.as_ref(),
        &[market_bump],
    ]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: mint_account,
                to: ata_account,
                authority: ctx.accounts.market.to_account_info(),
            },
            signer_seeds,
        ),
        mint_amount_u64,
    )?;

    // Pre-read values for emit and rent check
    let buyer_key = ctx.accounts.buyer.key();
    let market_key = ctx.accounts.market.key();

    let rent = Rent::get()?;
    let treasury_min = rent.minimum_balance(0);

    let market = &mut ctx.accounts.market;
    match side {
        Side::Yes => {
            market.yes_pool_lamports = market
                .yes_pool_lamports
                .checked_add(cost)
                .ok_or(SolPredictError::MathOverflow)?;
            market.yes_supply = market
                .yes_supply
                .checked_add(mint_amount_u64)
                .ok_or(SolPredictError::MathOverflow)?;
        }
        Side::No => {
            market.no_pool_lamports = market
                .no_pool_lamports
                .checked_add(cost)
                .ok_or(SolPredictError::MathOverflow)?;
            market.no_supply = market
                .no_supply
                .checked_add(mint_amount_u64)
                .ok_or(SolPredictError::MathOverflow)?;
        }
    }

    let position = &mut ctx.accounts.user_position;
    if position.owner == Pubkey::default() {
        position.owner = buyer_key;
        position.market = market_key;
        position.bump = ctx.bumps.user_position;
    }

    match side {
        Side::Yes => {
            position.yes_amount = position
                .yes_amount
                .checked_add(mint_amount_u64)
                .ok_or(SolPredictError::MathOverflow)?;
        }
        Side::No => {
            position.no_amount = position
                .no_amount
                .checked_add(mint_amount_u64)
                .ok_or(SolPredictError::MathOverflow)?;
        }
    }
    position.total_spent_lamports = position
        .total_spent_lamports
        .checked_add(cost)
        .ok_or(SolPredictError::MathOverflow)?;

    let new_yes_pool = market.yes_pool_lamports;
    let new_no_pool = market.no_pool_lamports;
    let market_id = market.market_id;

    // Rent exemption: treasury must stay above minimum or be empty after all claims
    let treasury_after = ctx.accounts.treasury.lamports();
    require!(treasury_after >= treasury_min || treasury_after == 0, SolPredictError::TreasuryInsufficient);

    ctx.accounts.market.reentrancy_lock.release();

    emit!(SharesPurchased {
        market_id,
        buyer: buyer_key,
        side,
        quantity,
        cost,
        new_yes_pool,
        new_no_pool,
    });

    Ok(())
}
