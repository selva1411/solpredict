use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::LiquidityAdded;
use crate::state::{LiquidityPosition, Market, MarketStatus};

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,

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
        payer = provider,
        associated_token::mint = yes_mint,
        associated_token::authority = provider,
    )]
    pub provider_yes_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = provider,
        associated_token::mint = no_mint,
        associated_token::authority = provider,
    )]
    pub provider_no_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = provider,
        space = LiquidityPosition::LEN,
        seeds = [LP_SEED, market.key().as_ref(), provider.key().as_ref()],
        bump,
    )]
    pub liquidity_position: Account<'info, LiquidityPosition>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AddLiquidity>, yes_lamports: u64, no_lamports: u64) -> Result<()> {
    // Get AccountInfo before mutable borrow
    let market_info = ctx.accounts.market.to_account_info();
    let market = &mut ctx.accounts.market;

    require!(market.status == MarketStatus::Open, SolPredictError::MarketNotOpen);
    require!(yes_lamports > 0 || no_lamports > 0, SolPredictError::InvalidQuantity);

    let clock = Clock::get()?;
    require!(clock.unix_timestamp < market.end_ts, SolPredictError::MarketExpired);

    let market_id = market.market_id;
    let market_bump = market.bump;
    let market_key = market.key();
    let provider_key = ctx.accounts.provider.key();

    // Build signer seeds once (avoids temporary value issues)
    let market_id_bytes = market_id.to_le_bytes();
    let signer_seeds: &[&[u8]] = &[MARKET_SEED, market_id_bytes.as_ref(), &[market_bump]];
    let signer_seeds_arr = &[&signer_seeds[..]];

    // CPI authority: market PDA signs as the mint authority

    market.reentrancy_lock.acquire(&crate::ID)?;

    let mut lp_tokens_minted: u64 = 0;

    if yes_lamports > 0 {
        lp_tokens_minted = lp_tokens_minted.checked_add(yes_lamports).ok_or(SolPredictError::MathOverflow)?;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.provider.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            yes_lamports,
        )?;

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.yes_mint.to_account_info(),
                    to: ctx.accounts.provider_yes_ata.to_account_info(),
                    authority: market_info.clone(),
                },
                signer_seeds_arr,
            ),
            yes_lamports,
        )?;

        market.yes_pool_lamports = market.yes_pool_lamports.checked_add(yes_lamports).ok_or(SolPredictError::MathOverflow)?;
        market.yes_supply = market.yes_supply.checked_add(yes_lamports).ok_or(SolPredictError::MathOverflow)?;
    }

    if no_lamports > 0 {
        lp_tokens_minted = lp_tokens_minted.checked_add(no_lamports).ok_or(SolPredictError::MathOverflow)?;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.provider.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            no_lamports,
        )?;

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.no_mint.to_account_info(),
                    to: ctx.accounts.provider_no_ata.to_account_info(),
                    authority: market_info.clone(),
                },
                signer_seeds_arr,
            ),
            no_lamports,
        )?;

        market.no_pool_lamports = market.no_pool_lamports.checked_add(no_lamports).ok_or(SolPredictError::MathOverflow)?;
        market.no_supply = market.no_supply.checked_add(no_lamports).ok_or(SolPredictError::MathOverflow)?;
    }

    let lp = &mut ctx.accounts.liquidity_position;
    if lp.owner == Pubkey::default() {
        lp.owner = provider_key;
        lp.market = market_key;
        lp.bump = ctx.bumps.liquidity_position;
        lp.created_at = clock.unix_timestamp;
    }
    lp.yes_deposited = lp.yes_deposited.checked_add(yes_lamports).ok_or(SolPredictError::MathOverflow)?;
    lp.no_deposited = lp.no_deposited.checked_add(no_lamports).ok_or(SolPredictError::MathOverflow)?;
    lp.lp_tokens = lp.lp_tokens.checked_add(lp_tokens_minted).ok_or(SolPredictError::MathOverflow)?;
    lp.total_lamports_deposited = lp.total_lamports_deposited
        .checked_add(yes_lamports)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_add(no_lamports)
        .ok_or(SolPredictError::MathOverflow)?;
    lp.updated_at = clock.unix_timestamp;

    market.reentrancy_lock.release();

    emit!(LiquidityAdded {
        market_id,
        provider: provider_key,
        yes_lamports,
        no_lamports,
        lp_tokens_minted,
    });

    Ok(())
}