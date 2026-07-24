use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::LiquidityRemoved;
use crate::state::{LiquidityPosition, Market};

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
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
        mut,
        associated_token::mint = yes_mint,
        associated_token::authority = provider,
    )]
    pub provider_yes_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = no_mint,
        associated_token::authority = provider,
    )]
    pub provider_no_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        close = provider,
        seeds = [LP_SEED, market.key().as_ref(), provider.key().as_ref()],
        bump = liquidity_position.bump,
    )]
    pub liquidity_position: Account<'info, LiquidityPosition>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RemoveLiquidity>, lp_tokens_to_burn: u64) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let lp = &ctx.accounts.liquidity_position;

    require!(lp.lp_tokens >= lp_tokens_to_burn, SolPredictError::NoLpTokens);
    require!(lp_tokens_to_burn > 0, SolPredictError::InvalidQuantity);

    // Pre-compute withdrawal amounts
    let lp_ratio = (lp_tokens_to_burn as u128)
        .checked_mul(PRECISION as u128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(lp.lp_tokens as u128)
        .ok_or(SolPredictError::MathOverflow)?;

    let yes_withdraw = ((lp.yes_deposited as u128)
        .checked_mul(lp_ratio)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(PRECISION as u128))
        .ok_or(SolPredictError::MathOverflow)? as u64;

    let no_withdraw = ((lp.no_deposited as u128)
        .checked_mul(lp_ratio)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(PRECISION as u128))
        .ok_or(SolPredictError::MathOverflow)? as u64;

    let yes_refund = yes_withdraw.min(
        (market.yes_pool_lamports as u128)
            .checked_mul(lp_ratio)
            .unwrap_or(0)
            .checked_div(PRECISION as u128)
            .unwrap_or(0) as u64,
    );
    let no_refund = no_withdraw.min(
        (market.no_pool_lamports as u128)
            .checked_mul(lp_ratio)
            .unwrap_or(0)
            .checked_div(PRECISION as u128)
            .unwrap_or(0) as u64,
    );

    let treasury_balance = ctx.accounts.treasury.lamports();
    let total_refund = yes_refund.checked_add(no_refund).ok_or(SolPredictError::MathOverflow)?;
    let safe_refund = total_refund.min(treasury_balance.saturating_sub(1));

    let yes_payout = if total_refund > 0 {
        (safe_refund as u128)
            .checked_mul(yes_refund as u128)
            .unwrap_or(0)
            .checked_div(total_refund as u128)
            .unwrap_or(0) as u64
    } else {
        0
    };
    let no_payout = safe_refund.saturating_sub(yes_payout);

    // Pre-read fields needed for signer seeds
    let market_id = market.market_id;
    let treasury_bump = market.treasury_bump;
    let market_key = market.key();
    let provider_key = ctx.accounts.provider.key();

    market.reentrancy_lock.acquire(&crate::ID)?;

    // Transfer from treasury
    if yes_payout > 0 && lp.yes_deposited > 0 {
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.treasury.to_account_info(),
                    to: ctx.accounts.provider.to_account_info(),
                },
                &[&[TREASURY_SEED, market_key.as_ref(), &[treasury_bump]]],
            ),
            yes_payout,
        )?;
    }

    if no_payout > 0 && lp.no_deposited > 0 {
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.treasury.to_account_info(),
                    to: ctx.accounts.provider.to_account_info(),
                },
                &[&[TREASURY_SEED, market_key.as_ref(), &[treasury_bump]]],
            ),
            no_payout,
        )?;
    }

    if lp.yes_deposited > 0 {
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.yes_mint.to_account_info(),
                    from: ctx.accounts.provider_yes_ata.to_account_info(),
                    authority: ctx.accounts.provider.to_account_info(),
                },
            ),
            (lp.yes_deposited as u128)
                .checked_mul(lp_ratio)
                .unwrap_or(0)
                .checked_div(PRECISION as u128)
                .unwrap_or(0) as u64,
        )?;
    }

    if lp.no_deposited > 0 {
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.no_mint.to_account_info(),
                    from: ctx.accounts.provider_no_ata.to_account_info(),
                    authority: ctx.accounts.provider.to_account_info(),
                },
            ),
            (lp.no_deposited as u128)
                .checked_mul(lp_ratio)
                .unwrap_or(0)
                .checked_div(PRECISION as u128)
                .unwrap_or(0) as u64,
        )?;
    }

    market.yes_pool_lamports = market.yes_pool_lamports.saturating_sub(yes_payout);
    market.no_pool_lamports = market.no_pool_lamports.saturating_sub(no_payout);
    market.yes_supply = market.yes_supply.saturating_sub(lp.yes_deposited);
    market.no_supply = market.no_supply.saturating_sub(lp.no_deposited);

    market.reentrancy_lock.release();

    emit!(LiquidityRemoved {
        market_id,
        provider: provider_key,
        yes_payout,
        no_payout,
        lp_tokens_burned: lp_tokens_to_burn,
    });

    Ok(())
}