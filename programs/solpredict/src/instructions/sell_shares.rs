use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::SharesSold;
use crate::state::{Market, MarketStatus, Side, UserPosition};

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
        mut,
        associated_token::mint = yes_mint,
        associated_token::authority = seller,
    )]
    pub seller_yes_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
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
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SellShares>, side: Side, quantity: u64) -> Result<()> {
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

    let mint_amount = (quantity as u128)
        .checked_mul(BASE_UNITS_PER_SHARE as u128)
        .ok_or(SolPredictError::MathOverflow)?;
    let mint_amount_u64 = u64::try_from(mint_amount).map_err(|_| SolPredictError::MathOverflow)?;

    let (mint, ata) = match side {
        Side::Yes => (&ctx.accounts.yes_mint, &ctx.accounts.seller_yes_ata),
        Side::No => (&ctx.accounts.no_mint, &ctx.accounts.seller_no_ata),
    };

    require!(
        ata.amount >= mint_amount_u64,
        SolPredictError::InsufficientShares
    );

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: mint.to_account_info(),
                from: ata.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        mint_amount_u64,
    )?;

    let refund = quantity
        .checked_mul(market.share_price_lamports)
        .ok_or(SolPredictError::MathOverflow)?;

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
    match side {
        Side::Yes => {
            market.yes_pool_lamports = market
                .yes_pool_lamports
                .checked_sub(refund)
                .ok_or(SolPredictError::MathOverflow)?;
            market.yes_supply = market
                .yes_supply
                .checked_sub(mint_amount_u64)
                .ok_or(SolPredictError::MathOverflow)?;
        }
        Side::No => {
            market.no_pool_lamports = market
                .no_pool_lamports
                .checked_sub(refund)
                .ok_or(SolPredictError::MathOverflow)?;
            market.no_supply = market
                .no_supply
                .checked_sub(mint_amount_u64)
                .ok_or(SolPredictError::MathOverflow)?;
        }
    }

    let position = &mut ctx.accounts.user_position;
    match side {
        Side::Yes => {
            position.yes_amount = position
                .yes_amount
                .checked_sub(mint_amount_u64)
                .ok_or(SolPredictError::MathOverflow)?;
        }
        Side::No => {
            position.no_amount = position
                .no_amount
                .checked_sub(mint_amount_u64)
                .ok_or(SolPredictError::MathOverflow)?;
        }
    }
    position.total_spent_lamports = position
        .total_spent_lamports
        .checked_sub(refund)
        .ok_or(SolPredictError::MathOverflow)?;

    emit!(SharesSold {
        market_id: market.market_id,
        seller: ctx.accounts.seller.key(),
        side,
        quantity,
        refund,
    });

    Ok(())
}
