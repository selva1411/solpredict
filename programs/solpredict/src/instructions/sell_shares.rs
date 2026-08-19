use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::SharesSold;
use crate::state::{EmergencyPause, Market, MarketStatus, Side, UserPosition};
use crate::utils::{amm_math, check_not_paused, payout_math};

#[derive(Accounts)]
pub struct SellShares<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, market.key().as_ref()],
        bump = market.treasury_bump,
    )]
    pub treasury: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [YES_MINT_SEED, market.key().as_ref()],
        bump,
    )]
    pub yes_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [NO_MINT_SEED, market.key().as_ref()],
        bump,
    )]
    pub no_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = yes_mint,
        associated_token::authority = seller,
    )]
    pub seller_yes_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = no_mint,
        associated_token::authority = seller,
    )]
    pub seller_no_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [POSITION_SEED, market.key().as_ref(), seller.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.owner == seller.key() @ SolPredictError::Unauthorized,
        constraint = user_position.market == market.key() @ SolPredictError::Unauthorized,
    )]
    pub user_position: Account<'info, UserPosition>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    /// Optional emergency-pause account. When present and paused, trading is halted.
    pub emergency_pause: Option<Account<'info, EmergencyPause>>,
}

pub fn handler(
    ctx: Context<SellShares>,
    side: Side,
    quantity: u64,
    min_proceeds_lamports: u64,
) -> Result<()> {
    check_not_paused(&ctx.accounts.emergency_pause)?;

    let market = &ctx.accounts.market;

    require!(market.status == MarketStatus::Open, SolPredictError::MarketNotOpen);

    let clock = Clock::get()?;
    require!(clock.unix_timestamp < market.end_ts, SolPredictError::MarketExpired);

    require!(quantity > 0 && quantity <= MAX_SHARES_PER_TX, SolPredictError::InvalidQuantity);

    let mint_amount = (quantity as u128)
        .checked_mul(BASE_UNITS_PER_SHARE as u128)
        .ok_or(SolPredictError::MathOverflow)?;
    let mint_amount_u64 = u64::try_from(mint_amount).map_err(|_| error!(SolPredictError::MathOverflow))?;

    let (ata_amount, is_yes) = match side {
        Side::Yes => (ctx.accounts.seller_yes_ata.amount, true),
        Side::No  => (ctx.accounts.seller_no_ata.amount, false),
    };

    require!(ata_amount >= mint_amount_u64, SolPredictError::InsufficientShares);

    let pool_yes = market.yes_pool_lamports as u128;
    let pool_no = market.no_pool_lamports as u128;
    let dy_in = (quantity as u128) * (market.share_price_lamports as u128);
    let fee_bps = market.fee_bps;
    let treasury_balance = ctx.accounts.treasury.lamports();
    let market_id = market.market_id;
    let seller_key = ctx.accounts.seller.key();

    let refund_u128 = if dy_in == 0 || pool_yes == 0 || pool_no == 0 {
        payout_math::calculate_cost(quantity, market.share_price_lamports)? as u128
    } else {
        match is_yes {
            true => amm_math::get_sell_amount_out(pool_yes, pool_no, dy_in, fee_bps),
            false => amm_math::get_sell_amount_out(pool_no, pool_yes, dy_in, fee_bps),
        }.map_err(|_| error!(SolPredictError::MathOverflow))?
    };
    let refund = u64::try_from(refund_u128)
        .unwrap_or(u64::MAX)
        .min(treasury_balance.saturating_sub(1));

    require!(refund > 0, SolPredictError::MathOverflow);

    // Slippage protection: reject the trade if the actual proceeds fall below
    // the seller's stated minimum, preventing front-running between simulation
    // and execution.
    require!(refund >= min_proceeds_lamports, SolPredictError::SlippageExceeded);

    let (mint_info, ata_info) = if is_yes {
        (ctx.accounts.yes_mint.to_account_info(), ctx.accounts.seller_yes_ata.to_account_info())
    } else {
        (ctx.accounts.no_mint.to_account_info(), ctx.accounts.seller_no_ata.to_account_info())
    };

    // Hold the market's reentrancy lock BEFORE any funds move. Previously the
    // lock was acquired after the refund transfer left the treasury.
    ctx.accounts.market.reentrancy_lock.acquire(&crate::ID)?;

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: mint_info,
                from: ata_info,
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        mint_amount_u64,
    )?;

    let market_key = ctx.accounts.market.key();
    let treasury_bump = ctx.accounts.market.treasury_bump;
    let seeds = &[TREASURY_SEED, market_key.as_ref(), &[treasury_bump]];
    let signer_seeds = &[&seeds[..]];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            },
            signer_seeds,
        ),
        refund,
    )?;

    let market = &mut ctx.accounts.market;
    if is_yes {
        market.yes_pool_lamports = market.yes_pool_lamports.saturating_sub(refund);
        market.yes_supply = market.yes_supply.saturating_sub(mint_amount_u64);
    } else {
        market.no_pool_lamports = market.no_pool_lamports.saturating_sub(refund);
        market.no_supply = market.no_supply.saturating_sub(mint_amount_u64);
    }

    let position = &mut ctx.accounts.user_position;
    if is_yes {
        position.yes_amount = position.yes_amount.saturating_sub(mint_amount_u64);
    } else {
        position.no_amount = position.no_amount.saturating_sub(mint_amount_u64);
    }
    position.total_spent_lamports = position.total_spent_lamports.saturating_sub(refund);

    market.reentrancy_lock.release();

    emit!(SharesSold {
        market_id,
        seller: seller_key,
        side,
        quantity,
        refund,
    });

    Ok(())
}